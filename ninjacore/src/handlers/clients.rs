//! Clients — list + per-client CRUD.
//!
//!   GET    /api/clients
//!   GET    /api/clients/:id
//!   DELETE /api/clients/:id
//!   PATCH  /api/clients/:id/status
//!   PATCH  /api/clients/:id/phase
//!   PATCH  /api/clients/:id/next-import
//!   PATCH  /api/clients/:id/financial-profile
//!   PATCH  /api/clients/:id/profile
//!
//! Sensitive fields (`monitoring_password`, `portal_password`, `ssn`) are
//! stripped on the way out by `to_safe_client`.

use std::path::PathBuf;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::report_run::{agency_runner_type, start_browser_report_run, StartParams};
use crate::state::AppState;

/// Shape returned for client list rows (matches `toClientListItem` from server.mjs).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientListItem {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub phase: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub monitoring_agency: String,
    #[serde(default)]
    pub report_date: String,
    /// Days until next credit-report import. Negative = overdue.
    /// Computed server-side from next_import_mode + related anchor fields.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days_left: Option<i64>,
}

/// Raw client row used to compute days_left before serializing.
#[derive(Debug, Deserialize)]
struct ClientListRow {
    id: String,
    #[serde(default)]
    first_name: Option<String>,
    #[serde(default)]
    last_name: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    phase: Option<String>,
    #[serde(default)]
    monitoring_agency: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    phone: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
    #[serde(default)]
    next_import_mode: Option<String>,
    #[serde(default)]
    next_import_int: Option<Value>,
    #[serde(default)]
    manual_next_import_start_days: Option<Value>,
    #[serde(default)]
    manual_next_import_set_date: Option<String>,
    #[serde(default)]
    refresh_next_import_start_date: Option<String>,
    #[serde(default)]
    report_date: Option<String>,
}

fn parse_iso_date(s: &str) -> Option<time::Date> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Accept YYYY-MM-DD or full ISO timestamps; take first 10 chars.
    let head: String = trimmed.chars().take(10).collect();
    time::Date::parse(
        &head,
        &time::macros::format_description!("[year]-[month]-[day]"),
    )
    .ok()
}

fn percent_hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(10 + (b - b'a')),
        b'A'..=b'F' => Some(10 + (b - b'A')),
        _ => None,
    }
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(bytes.len());
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h1), Some(h2)) = (percent_hex_val(bytes[i + 1]), percent_hex_val(bytes[i + 2])) {
                out.push((h1 << 4 | h2) as char);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

fn normalize_client_id(raw_id: &str) -> String {
    let decoded = percent_decode(raw_id);
    let decoded = decoded.trim();
    if decoded.is_empty() {
        return String::new();
    }

    let no_prefix = decoded
        .split_once(':')
        .map(|(_table, tail)| tail)
        .unwrap_or(decoded)
        .trim();
    let no_ticks = no_prefix.trim_matches('`').trim();
    let no_ticks = no_ticks.trim_matches('\'').trim();

    match no_ticks.rsplit_once(':') {
        Some((_table, local_id)) => local_id.trim().trim_matches('`').to_string(),
        None => no_ticks.to_string(),
    }
}

fn parse_i64(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.trim().parse::<i64>().ok(),
        _ => None,
    }
}

fn today_utc() -> time::Date {
    time::OffsetDateTime::now_utc().date()
}

fn compute_days_left(row: &ClientListRow) -> Option<i64> {
    let mode = row
        .next_import_mode
        .as_deref()
        .unwrap_or("manual")
        .to_ascii_lowercase();
    let today = today_utc();
    if mode == "refresh-success" {
        let anchor = row
            .refresh_next_import_start_date
            .as_deref()
            .and_then(parse_iso_date)
            .or_else(|| row.report_date.as_deref().and_then(parse_iso_date))
            .unwrap_or(today);
        let elapsed = (today - anchor).whole_days().max(0);
        return Some(35 - elapsed);
    }
    // manual mode
    let start_days = row
        .manual_next_import_start_days
        .as_ref()
        .and_then(parse_i64)
        .or_else(|| row.next_import_int.as_ref().and_then(parse_i64))?;
    let anchor = row
        .manual_next_import_set_date
        .as_deref()
        .and_then(parse_iso_date)
        .unwrap_or(today);
    let elapsed = (today - anchor).whole_days().max(0);
    Some(start_days - elapsed)
}

pub async fn list_clients(
    _user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    // Fan out the three independent reads concurrently on the Tokio runtime.
    let clients_fut = async {
        let mut resp = state
            .db
            .query(
                "SELECT id, first_name, last_name, status, phase, email, phone, updated_at, \
                        next_import_mode, next_import_int, \
                        manual_next_import_start_days, manual_next_import_set_date, \
                        monitoring_agency, \
                        refresh_next_import_start_date, report_date \
                 FROM clients WHERE status = 'Client' ORDER BY last_name, first_name",
            )
            .await?;
        let rows = crate::db::take_many::<ClientListRow>(&mut resp, 0)?;
        let mut items: Vec<ClientListItem> = rows
            .into_iter()
            .map(|row| {
                let days_left = compute_days_left(&row);
                ClientListItem {
                    id: normalize_client_id(&row.id),
                    first_name: row.first_name.unwrap_or_default(),
                    last_name: row.last_name.unwrap_or_default(),
                    status: row.status.unwrap_or_default(),
                    phase: row.phase.unwrap_or_default(),
                    email: row.email.unwrap_or_default(),
                    phone: row.phone.unwrap_or_default(),
                    updated_at: row.updated_at,
                    monitoring_agency: row.monitoring_agency.unwrap_or_default(),
                    report_date: row.report_date.unwrap_or_default(),
                    days_left,
                }
            })
            .collect();
        // Most past due first: smallest days_left first (negatives float to top),
        // rows with no computable days_left go last.
        items.sort_by(|a, b| match (a.days_left, b.days_left) {
            (Some(x), Some(y)) => x.cmp(&y),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        });
        Ok::<Vec<ClientListItem>, AppError>(items)
    };
    let statuses_fut = load_taxonomy(&state, "taxonomy.client_statuses");
    let phases_fut = load_taxonomy(&state, "taxonomy.client_phases");

    let (clients_res, statuses_res, phases_res) =
        tokio::join!(clients_fut, statuses_fut, phases_fut);

    Ok(Json(json!({
        "statuses": statuses_res.unwrap_or_else(default_statuses),
        "phases": phases_res.unwrap_or_else(default_phases),
        "clients": clients_res?,
    })))
}

pub async fn get_client(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let id = normalize_client_id(&id);
    let row = load_client_raw(&state, &id).await?;
    Ok(Json(json!({ "client": to_safe_client(row) })))
}

pub async fn delete_client(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let id = normalize_client_id(&id);
    let mut __resp = state
        .db
        .query("DELETE type::record('clients', $id) RETURN BEFORE")
        .bind(("id", id.clone()))
        .await?;
    let deleted: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    // (No cascade — live schema doesn't have report_run/client_profile tables.
    //  Related rows in `reports` / `report_data_entries` are left in place.)
    Ok(Json(json!({ "ok": true, "deletedId": id })))
}

// ─── PATCH variants ───────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct StatusPatch {
    pub status: String,
}

pub async fn patch_status(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<StatusPatch>,
) -> AppResult<Json<Value>> {
    let next = body.status.trim().to_string();
    if next.is_empty() {
        return Err(AppError::BadRequest("Status is required.".into()));
    }
    let id = normalize_client_id(&id);
    let mut __resp = state
        .db
        .query("UPDATE type::record('clients', $id) SET status = $s, updated_at = time::now() RETURN AFTER")
        .bind(("id", id))
        .bind(("s", next.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    let statuses = append_taxonomy(&state, "taxonomy.client_statuses", &next).await?;
    Ok(Json(
        json!({ "ok": true, "client": to_safe_client(client), "statuses": statuses }),
    ))
}

#[derive(Deserialize)]
pub struct PhasePatch {
    pub phase: String,
}

pub async fn patch_phase(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<PhasePatch>,
) -> AppResult<Json<Value>> {
    let next = body.phase.trim().to_string();
    if next.is_empty() {
        return Err(AppError::BadRequest("Phase is required.".into()));
    }
    let id = normalize_client_id(&id);
    let mut __resp = state
        .db
        .query("UPDATE type::record('clients', $id) SET phase = $p, updated_at = time::now() RETURN AFTER")
        .bind(("id", id))
        .bind(("p", next.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    let phases = append_taxonomy(&state, "taxonomy.client_phases", &next).await?;
    Ok(Json(
        json!({ "ok": true, "client": to_safe_client(client), "phases": phases }),
    ))
}

#[derive(Deserialize)]
pub struct NextImportPatch {
    pub days: serde_json::Value,
}

pub async fn patch_next_import(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<NextImportPatch>,
) -> AppResult<Json<Value>> {
    let days = body
        .days
        .as_i64()
        .or_else(|| {
            body.days
                .as_str()
                .and_then(|s| s.trim().parse::<i64>().ok())
        })
        .ok_or_else(|| AppError::BadRequest("Next Import days must be a number.".into()))?;
    let (next_int, next_label) = format_next_import(days);
    let today = time::OffsetDateTime::now_utc()
        .date()
        .format(&time::format_description::well_known::Iso8601::DATE)
        .unwrap_or_default();
    let id = normalize_client_id(&id);

    let mut __resp = state
        .db
        .query(
            "UPDATE type::record('clients', $id) SET \
            next_import_int = $ni, next_import_label = $nl, \
            next_import_mode = 'manual', \
            manual_next_import_start_days = $days, \
            manual_next_import_set_date = $today, \
            updated_at = time::now() \
            RETURN AFTER",
        )
        .bind(("id", id))
        .bind(("ni", next_int))
        .bind(("nl", next_label))
        .bind(("days", days))
        .bind(("today", today))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    Ok(Json(
        json!({ "ok": true, "client": to_safe_client(client) }),
    ))
}

#[derive(Deserialize)]
pub struct FinancialPatch {
    #[serde(default, rename = "yearlyIncome")]
    pub yearly_income: Option<String>,
}

pub async fn patch_financial(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<FinancialPatch>,
) -> AppResult<Json<Value>> {
    let yearly_income = body.yearly_income.unwrap_or_default().trim().to_string();
    let id = normalize_client_id(&id);
    let mut __resp = state.db.query(
        "UPDATE type::record('clients', $id) SET yearly_income = $yi, updated_at = time::now() RETURN AFTER")
        .bind(("id", id))
        .bind(("yi", yearly_income))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    Ok(Json(
        json!({ "ok": true, "client": to_safe_client(client) }),
    ))
}

/// Full profile PATCH — mirrors the long server.mjs handler.
/// Uses a generic `MERGE` of the supplied JSON onto the existing record, then
/// derives a few computed fields (secret_key fallback to SSN last4, portal_password fallback).
#[derive(Deserialize)]
pub struct ProfilePatch {
    #[serde(flatten)]
    pub fields: serde_json::Map<String, Value>,
}

pub async fn patch_profile(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<ProfilePatch>,
) -> AppResult<Json<Value>> {
    let id = normalize_client_id(&id);
    // No pre-fetch. Fields the Edit form always sends are bound directly;
    // fields the form omits (goal/notes/financials/reportDate/nextImportInt)
    // use SurrealQL's `IF $foo_set THEN $foo ELSE foo END` so the DB itself
    // preserves the existing value. One round trip instead of two.

    let pick_str = |key: &str| -> Option<String> {
        body.fields
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    let req = |key: &str| -> String { pick_str(key).unwrap_or_default() };
    let req_or = |key: &str, default: &str| -> String {
        let v = req(key);
        if v.is_empty() {
            default.into()
        } else {
            v
        }
    };

    // Always-sent fields from the Edit Client form.
    let first_name = req("firstName");
    let last_name = req("lastName");
    let email = req("email");
    let phone = req("phone");
    let dob = normalize_dob(&req("dob"));
    let ssn = normalize_ssn(&req("ssn"));
    let address = req("address");
    let status = req_or("status", "Client");
    let phase = req_or("phase", "None");
    let language = req_or("language", "English");
    let affiliate = req_or("affiliateAssigned", "None");
    let monitoring_agency = req("monitoringAgency");
    let monitoring_user = req("monitoringUsername");
    let monitoring_pass = req("monitoringPassword");
    let monitoring_token = req("tokenId");
    let spouse_id = req("spouseClientId");
    let spouse_label = req("spouseClientLabel");
    let assigned_to = req("assignedTo");
    let ninja_assigned = req("ninjaAssigned");

    let requested_secret = req("secretKey");
    let secret_key = if requested_secret.is_empty() {
        last_four(&ssn).to_string()
    } else {
        requested_secret
    };
    let requested_portal = req("portalPassword");
    let portal_password = if requested_portal.is_empty() {
        default_portal_password(&last_name, &ssn)
    } else {
        requested_portal
    };
    let portal_enabled = req("portalEnabled").to_lowercase() != "off";

    // Conditional fields — only update if body actually sent them.
    let goal_opt = pick_str("goal");
    let notes_opt = pick_str("notes");
    let yi_opt = pick_str("yearlyIncome");
    let hp_opt = pick_str("housingPayment");
    let dmp_opt = pick_str("debtMonthlyPayments");
    let rd_opt = pick_str("reportDate");

    // next_import — only touch the related fields if a value came in.
    let ni_raw = pick_str("nextImportInt").map(|s| s.trim().to_string());
    let (ni_opt, nl_opt, manual_days_set, today_set) = match ni_raw {
        Some(s) => {
            if let Ok(n) = s.parse::<i64>() {
                let (i, l) = format_next_import(n);
                let today = time::OffsetDateTime::now_utc()
                    .date()
                    .format(&time::format_description::well_known::Iso8601::DATE)
                    .unwrap_or_default();
                (Some(i), Some(l), Some(n), Some(today))
            } else {
                (Some(s.clone()), Some(s), None, None)
            }
        }
        None => (None, None, None, None),
    };

    let email_n = email.trim().to_lowercase();
    let phone_n: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

    let goal_set = goal_opt.is_some();
    let notes_set = notes_opt.is_some();
    let yi_set = yi_opt.is_some();
    let hp_set = hp_opt.is_some();
    let dmp_set = dmp_opt.is_some();
    let rd_set = rd_opt.is_some();
    let ni_set = ni_opt.is_some();

    let mut __resp = state.db.query(
        "UPDATE type::record('clients', $id) SET \
            first_name = $fn, last_name = $ln, email = $email, phone = $phone, \
            email_n = $em, phone_n = $ph, \
            dob = $dob, ssn = $ssn, address = $address, \
            status = $status, phase = $phase, language = $lang, \
            affiliate_assigned = $aff, assigned_to = $assigned, ninja_assigned = $ninja, \
            spouse_client_id = $sid, spouse_client_label = $slabel, \
            monitoring_agency = $ma, monitoring_username = $mu, monitoring_password = $mp, monitoring_token = $mt, \
            secret_key = $sk, portal_password = $pp, portal_enabled = $pe, \
            goal = IF $goal_set THEN $goal ELSE goal END, \
            notes = IF $notes_set THEN $notes ELSE notes END, \
            yearly_income = IF $yi_set THEN $yi ELSE yearly_income END, \
            housing_payment = IF $hp_set THEN $hp ELSE housing_payment END, \
            debt_monthly_payments = IF $dmp_set THEN $dmp ELSE debt_monthly_payments END, \
            report_date = IF $rd_set THEN $rd ELSE report_date END, \
            next_import_int = IF $ni_set THEN $ni ELSE next_import_int END, \
            next_import_label = IF $ni_set THEN $nl ELSE next_import_label END, \
            next_import_mode = IF $manualDays THEN 'manual' ELSE next_import_mode END, \
            manual_next_import_start_days = IF $manualDays THEN $manualDays ELSE manual_next_import_start_days END, \
            manual_next_import_set_date = IF $manualToday THEN $manualToday ELSE manual_next_import_set_date END, \
            updated_at = time::now() \
        RETURN AFTER")
        .bind(("id", id))
        .bind(("fn", first_name))
        .bind(("ln", last_name))
        .bind(("email", email))
        .bind(("phone", phone))
        .bind(("em", email_n))
        .bind(("ph", phone_n))
        .bind(("dob", dob))
        .bind(("ssn", ssn))
        .bind(("address", address))
        .bind(("status", status.clone()))
        .bind(("phase", phase.clone()))
        .bind(("lang", language))
        .bind(("aff", affiliate))
        .bind(("assigned", assigned_to))
        .bind(("ninja", ninja_assigned))
        .bind(("sid", spouse_id))
        .bind(("slabel", spouse_label))
        .bind(("ma", monitoring_agency))
        .bind(("mu", monitoring_user))
        .bind(("mp", monitoring_pass))
        .bind(("mt", monitoring_token))
        .bind(("sk", secret_key))
        .bind(("pp", portal_password))
        .bind(("pe", portal_enabled))
        .bind(("goal", goal_opt.unwrap_or_default()))
        .bind(("goal_set", goal_set))
        .bind(("notes", notes_opt.unwrap_or_default()))
        .bind(("notes_set", notes_set))
        .bind(("yi", yi_opt.unwrap_or_default()))
        .bind(("yi_set", yi_set))
        .bind(("hp", hp_opt.unwrap_or_default()))
        .bind(("hp_set", hp_set))
        .bind(("dmp", dmp_opt.unwrap_or_default()))
        .bind(("dmp_set", dmp_set))
        .bind(("rd", rd_opt.unwrap_or_default()))
        .bind(("rd_set", rd_set))
        .bind(("ni", ni_opt.unwrap_or_default()))
        .bind(("nl", nl_opt.unwrap_or_default()))
        .bind(("ni_set", ni_set))
        .bind(("manualDays", manual_days_set))
        .bind(("manualToday", today_set))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;

    let (statuses, phases) = tokio::try_join!(
        append_taxonomy(&state, "taxonomy.client_statuses", &status),
        append_taxonomy(&state, "taxonomy.client_phases", &phase),
    )?;

    Ok(Json(json!({
        "ok": true,
        "client": to_safe_client(client),
        "statuses": statuses,
        "phases": phases,
    })))
}

// ─── Refresh report (browser runner) ─────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshReportBody {
    #[serde(default)]
    pub force_paid: bool,
    #[serde(default)]
    pub monitoring_agency: Option<String>,
    #[serde(default)]
    pub monitoring_username: Option<String>,
    #[serde(default)]
    pub monitoring_password: Option<String>,
    #[serde(default, rename = "tokenId")]
    pub monitoring_token: Option<String>,
    #[serde(default)]
    pub secret_key: Option<String>,
}

pub async fn refresh_report(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Option<Json<RefreshReportBody>>,
) -> AppResult<impl IntoResponse> {
    let body = body.map(|Json(b)| b).unwrap_or_default();
    let id = normalize_client_id(&id);

    // Persist any credential overrides the form supplied before launching, so
    // the script can re-fetch the client by id and see fresh values.
    persist_refresh_overrides(&state, &id, &body).await?;

    let row = load_client_raw(&state, &id).await?;
    let mut camel = client_to_camel(&row);

    // Prefer the agency the operator submitted with this refresh over whatever
    // is in the row — the persist may not have settled yet, and the form is
    // the source of truth for "what to run now".
    let body_agency = body
        .monitoring_agency
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    if let Some(agency_override) = body_agency {
        if let Some(obj) = camel.as_object_mut() {
            obj.insert(
                "monitoringAgency".into(),
                Value::String(agency_override.to_string()),
            );
        }
    }

    let agency_raw = camel
        .get("monitoringAgency")
        .and_then(Value::as_str)
        .unwrap_or("");
    let runner = agency_runner_type(agency_raw).ok_or_else(|| {
        AppError::BadRequest(format!(
            "This client's monitoring agency ({:?}) is not a supported browser-run service \
             (IdentityIQ, SmartCredit, MyFreeScoreNow).",
            agency_raw
        ))
    })?;

    let params = StartParams {
        script_path: PathBuf::from(&state.cfg.report_script_path),
        script_cwd: PathBuf::from(&state.cfg.report_script_cwd),
        node_bin: state.cfg.node_bin.clone(),
        api_base: state.cfg.tools_ninja_api_base.clone(),
        client: camel,
    };

    let handle = start_browser_report_run(&state.report_runs, params, vec![]).await?;
    let g = handle.read().await;
    let snap = g.snapshot();

    Ok((
        StatusCode::ACCEPTED,
        Json(json!({
            "ok": true,
            "started": true,
            "runId": snap.get("id").cloned().unwrap_or(Value::Null),
            "runnerType": runner,
            "refreshMode": "browser",
            "status": snap.get("status").cloned().unwrap_or(Value::Null),
            "logs": snap.get("logs").cloned().unwrap_or_else(|| json!([])),
        })),
    ))
}

pub async fn get_report_run(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> AppResult<Json<Value>> {
    let handle = state
        .report_runs
        .get(&run_id)
        .map(|r| r.value().clone())
        .ok_or(AppError::NotFound)?;
    let g = handle.read().await;
    Ok(Json(json!({ "run": g.snapshot() })))
}

async fn persist_refresh_overrides(
    state: &AppState,
    id: &str,
    body: &RefreshReportBody,
) -> AppResult<()> {
    let has_override = body.monitoring_agency.is_some()
        || body.monitoring_username.is_some()
        || body.monitoring_password.is_some()
        || body.monitoring_token.is_some()
        || body.secret_key.is_some();
    if !has_override {
        return Ok(());
    }

    let mut sets: Vec<&str> = Vec::new();
    if body.monitoring_agency.is_some() {
        sets.push("monitoring_agency = $ma");
    }
    if body.monitoring_username.is_some() {
        sets.push("monitoring_username = $mu");
    }
    if body.monitoring_password.is_some() {
        sets.push("monitoring_password = $mp");
    }
    if body.monitoring_token.is_some() {
        sets.push("monitoring_token = $mt");
    }
    if body.secret_key.is_some() {
        sets.push("secret_key = $sk");
    }

    let update = format!(
        "UPDATE type::record('clients', $id) SET {} RETURN NONE",
        sets.join(", ")
    );
    let mut q = state.db.query(update).bind(("id", id.to_string()));
    if let Some(v) = &body.monitoring_agency {
        q = q.bind(("ma", v.clone()));
    }
    if let Some(v) = &body.monitoring_username {
        q = q.bind(("mu", v.clone()));
    }
    if let Some(v) = &body.monitoring_password {
        q = q.bind(("mp", v.clone()));
    }
    if let Some(v) = &body.monitoring_token {
        q = q.bind(("mt", v.clone()));
    }
    if let Some(v) = &body.secret_key {
        q = q.bind(("sk", v.clone()));
    }
    q.await?;
    Ok(())
}

/// Map snake_case client row from SurrealDB → camelCase JSON that the Node
/// browser script expects via `TOOLS_NINJA_CLIENT`.
fn client_to_camel(row: &Value) -> Value {
    let id_str = row
        .get("id")
        .and_then(Value::as_str)
        .map(|s| s.rsplit_once(':').map(|(_, t)| t).unwrap_or(s).to_string())
        .unwrap_or_default();
    let f = |k: &str| row.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    json!({
        "id": id_str,
        "firstName": f("first_name"),
        "lastName": f("last_name"),
        "email": f("email"),
        "ssn": f("ssn"),
        "monitoringAgency": f("monitoring_agency"),
        "monitoringUsername": f("monitoring_username"),
        "monitoringPassword": f("monitoring_password"),
        "tokenId": f("monitoring_token"),
        "secretKey": f("secret_key"),
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async fn load_client_raw(state: &AppState, id: &str) -> AppResult<Value> {
    let id = normalize_client_id(id);
    if id.is_empty() {
        return Err(AppError::BadRequest("Invalid client id.".into()));
    }
    let mut __resp = state
        .db
        .query("SELECT * FROM ONLY type::record('clients', $id) LIMIT 1")
        .bind(("id", id.to_string()))
        .await?;
    let row: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    row.ok_or(AppError::NotFound)
}

fn to_safe_client(mut v: Value) -> Value {
    if let Some(obj) = v.as_object_mut() {
        obj.remove("monitoring_password");
        obj.remove("portal_password");
        obj.remove("secret_key");
        if let Some(ssn) = obj.get("ssn").and_then(|s| s.as_str()) {
            let masked = mask_ssn(ssn);
            obj.insert("ssn".into(), Value::String(masked));
        }
    }
    v
}

fn mask_ssn(s: &str) -> String {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 4 {
        return String::new();
    }
    format!("***-**-{}", &digits[digits.len() - 4..])
}

fn last_four(ssn: &str) -> &str {
    let bytes = ssn.as_bytes();
    let n = bytes.iter().filter(|b| b.is_ascii_digit()).count();
    if n < 4 {
        return "";
    }
    let mut idx = 0;
    let mut chars_left = 4;
    for (i, b) in bytes.iter().enumerate().rev() {
        if b.is_ascii_digit() {
            chars_left -= 1;
            if chars_left == 0 {
                idx = i;
                break;
            }
        }
    }
    &ssn[idx..]
}

fn default_portal_password(last_name: &str, ssn: &str) -> String {
    let last = last_name
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_lowercase();
    let four = last_four(ssn);
    if last.is_empty() && four.is_empty() {
        return String::new();
    }
    format!("{last}{four}")
}

fn normalize_ssn(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 9 {
        return raw.trim().to_string();
    }
    format!("{}-{}-{}", &digits[..3], &digits[3..5], &digits[5..])
}

fn normalize_dob(raw: &str) -> String {
    let t = raw.trim();
    // Accept YYYY-MM-DD as-is; convert MM/DD/YYYY → YYYY-MM-DD; pass anything else through.
    if t.len() == 10 && t.as_bytes()[4] == b'-' && t.as_bytes()[7] == b'-' {
        return t.to_string();
    }
    if t.len() == 10 && (t.as_bytes()[2] == b'/' || t.as_bytes()[2] == b'-') {
        let (m, rest) = t.split_at(2);
        let (sep1, rest) = rest.split_at(1);
        let _ = sep1;
        let (d, rest) = rest.split_at(2);
        let (_sep2, y) = rest.split_at(1);
        return format!("{y}-{m}-{d}");
    }
    t.to_string()
}

fn format_next_import(days: i64) -> (String, String) {
    let label = if days == 0 {
        "today".into()
    } else if days == 1 {
        "1 day".into()
    } else {
        format!("{days} days")
    };
    (days.to_string(), label)
}

fn snake(camel: &str) -> String {
    let mut out = String::with_capacity(camel.len() + 4);
    for (i, c) in camel.chars().enumerate() {
        if c.is_ascii_uppercase() {
            if i > 0 {
                out.push('_');
            }
            out.push(c.to_ascii_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

async fn load_taxonomy(state: &AppState, key: &str) -> Option<Vec<String>> {
    #[derive(Deserialize)]
    struct Row {
        value_json: String,
    }
    let mut resp = state
        .db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await
        .ok()?;
    let row: Option<Row> = crate::db::take_one(&mut resp, 0).ok()?;
    serde_json::from_str(&row?.value_json).ok()
}

async fn append_taxonomy(state: &AppState, key: &str, value: &str) -> AppResult<Vec<String>> {
    let mut list = load_taxonomy(state, key).await.unwrap_or_default();
    let v = value.trim();
    if !v.is_empty() && !list.iter().any(|x| x.eq_ignore_ascii_case(v)) {
        list.push(v.to_string());
    }
    let payload = serde_json::to_string(&list).unwrap();
    state
        .db
        .query(
            "UPSERT settings:[$k] SET setting_key = $k, value_json = $v, updated_at = time::now()",
        )
        .bind(("k", key.to_string()))
        .bind(("v", payload))
        .await?;
    Ok(list)
}

fn default_statuses() -> Vec<String> {
    ["Lead", "Prospect", "Client", "Graduated", "Cancelled"]
        .iter()
        .map(|s| s.to_string())
        .collect()
}

fn default_phases() -> Vec<String> {
    [
        "None",
        "Onboarding",
        "Round 1",
        "Round 2",
        "Round 3",
        "Monitoring",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}
