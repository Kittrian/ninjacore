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
pub struct ClientListItem {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    #[serde(default)] pub status: String,
    #[serde(default)] pub phase: Option<String>,
    #[serde(default)] pub email: Option<String>,
    #[serde(default)] pub phone: Option<String>,
    #[serde(default)] pub updated_at: Option<String>,
}

pub async fn list_clients(
    _user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let mut __resp = state
        .db
        .query(
            "SELECT id, first_name, last_name, status, phase, email, phone, updated_at \
             FROM clients WHERE string::lowercase(status) = 'client' ORDER BY last_name, first_name",
        )
        .await?;
    let clients: Vec<ClientListItem> = crate::db::take_many(&mut __resp, 0)?;

    let statuses = load_taxonomy(&state, "taxonomy.client_statuses")
        .await
        .unwrap_or_else(default_statuses);
    let phases = load_taxonomy(&state, "taxonomy.client_phases")
        .await
        .unwrap_or_else(default_phases);

    Ok(Json(json!({
        "statuses": statuses,
        "phases": phases,
        "clients": clients,
    })))
}

pub async fn get_client(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let row = load_client_raw(&state, &id).await?;
    Ok(Json(json!({ "client": to_safe_client(row) })))
}

pub async fn delete_client(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let mut __resp = state
        .db
        .query("DELETE type::thing('clients', $id) RETURN BEFORE")
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
pub struct StatusPatch { pub status: String }

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
    let mut __resp = state
        .db
        .query("UPDATE type::thing('clients', $id) SET status = $s, updated_at = time::now() RETURN AFTER")
        .bind(("id", id))
        .bind(("s", next.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    let statuses = append_taxonomy(&state, "taxonomy.client_statuses", &next).await?;
    Ok(Json(json!({ "ok": true, "client": to_safe_client(client), "statuses": statuses })))
}

#[derive(Deserialize)]
pub struct PhasePatch { pub phase: String }

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
    let mut __resp = state
        .db
        .query("UPDATE type::thing('clients', $id) SET phase = $p, updated_at = time::now() RETURN AFTER")
        .bind(("id", id))
        .bind(("p", next.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    let phases = append_taxonomy(&state, "taxonomy.client_phases", &next).await?;
    Ok(Json(json!({ "ok": true, "client": to_safe_client(client), "phases": phases })))
}

#[derive(Deserialize)]
pub struct NextImportPatch { pub days: serde_json::Value }

pub async fn patch_next_import(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<NextImportPatch>,
) -> AppResult<Json<Value>> {
    let days = body.days.as_i64()
        .or_else(|| body.days.as_str().and_then(|s| s.trim().parse::<i64>().ok()))
        .ok_or_else(|| AppError::BadRequest("Next Import days must be a number.".into()))?;
    let (next_int, next_label) = format_next_import(days);
    let today = time::OffsetDateTime::now_utc()
        .date()
        .format(&time::format_description::well_known::Iso8601::DATE)
        .unwrap_or_default();

    let mut __resp = state.db.query(
        "UPDATE type::thing('clients', $id) SET \
            next_import_int = $ni, next_import_label = $nl, \
            next_import_mode = 'manual', \
            manual_next_import_start_days = $days, \
            manual_next_import_set_date = $today, \
            updated_at = time::now() \
            RETURN AFTER")
        .bind(("id", id))
        .bind(("ni", next_int))
        .bind(("nl", next_label))
        .bind(("days", days))
        .bind(("today", today))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true, "client": to_safe_client(client) })))
}

#[derive(Deserialize)]
pub struct FinancialPatch {
    #[serde(default, rename = "yearlyIncome")] pub yearly_income: Option<String>,
}

pub async fn patch_financial(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<FinancialPatch>,
) -> AppResult<Json<Value>> {
    let yearly_income = body.yearly_income.unwrap_or_default().trim().to_string();
    let mut __resp = state.db.query(
        "UPDATE type::thing('clients', $id) SET yearly_income = $yi, updated_at = time::now() RETURN AFTER")
        .bind(("id", id))
        .bind(("yi", yearly_income))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true, "client": to_safe_client(client) })))
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
    let existing = load_client_raw(&state, &id).await?;

    // Pull values with existing fallback (matches readOptionalStringField behavior).
    let pick = |key: &str| -> String {
        if let Some(v) = body.fields.get(key).and_then(|v| v.as_str()) {
            v.to_string()
        } else {
            existing.get(snake(key).as_str())
                .or_else(|| existing.get(key))
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string()
        }
    };
    let pick_or = |key: &str, default: &str| -> String {
        let v = pick(key);
        if v.is_empty() { default.into() } else { v }
    };

    let first_name = pick("firstName");
    let last_name = pick("lastName");
    let email = pick("email");
    let phone = pick("phone");
    let dob = normalize_dob(&pick("dob"));
    let ssn = normalize_ssn(&pick("ssn"));
    let address = pick("address");
    let status = pick_or("status", "Client");
    let phase = pick_or("phase", "None");
    let language = pick_or("language", "English");
    let affiliate = pick_or("affiliateAssigned", "None");
    let monitoring_agency = pick("monitoringAgency");
    let monitoring_user = pick("monitoringUsername");
    let monitoring_pass = pick("monitoringPassword");
    let monitoring_token = pick("monitoringToken");
    let goal = pick("goal");
    let notes = pick("notes");
    let yearly_income = pick("yearlyIncome");
    let housing_payment = pick("housingPayment");
    let debt = pick("debtMonthlyPayments");
    let report_date = pick("reportDate");
    let spouse_id = pick("spouseClientId");
    let spouse_label = pick("spouseClientLabel");
    let assigned_to = pick("assignedTo");
    let ninja_assigned = pick("ninjaAssigned");

    let requested_secret = pick("secretKey");
    let secret_key = if requested_secret.is_empty() {
        last_four(&ssn).to_string()
    } else {
        requested_secret
    };
    let requested_portal = pick("portalPassword");
    let portal_password = if requested_portal.is_empty() {
        default_portal_password(&last_name, &ssn)
    } else {
        requested_portal
    };
    let portal_enabled = pick_or("portalEnabled", if existing.get("portal_enabled").and_then(|v| v.as_bool()).unwrap_or(false) { "on" } else { "off" })
        .to_lowercase() != "off";

    // next_import
    let next_import_raw = body.fields.get("nextImportInt").cloned()
        .unwrap_or_else(|| existing.get("next_import_int").cloned().unwrap_or(Value::Null));
    let next_import_str = next_import_raw.as_str().unwrap_or("").trim().to_string();
    let (ni, nl, manual_days_set, today_set) = if let Ok(n) = next_import_str.parse::<i64>() {
        let (i, l) = format_next_import(n);
        let today = time::OffsetDateTime::now_utc()
            .date()
            .format(&time::format_description::well_known::Iso8601::DATE)
            .unwrap_or_default();
        (i, l, Some(n), Some(today))
    } else {
        (next_import_str.clone(), next_import_str, None, None)
    };

    let email_n = email.trim().to_lowercase();
    let phone_n: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

    let mut __resp = state.db.query(
        "UPDATE type::thing('clients', $id) SET \
            first_name = $fn, last_name = $ln, email = $email, phone = $phone, \
            email_n = $em, phone_n = $ph, \
            dob = $dob, ssn = $ssn, address = $address, \
            status = $status, phase = $phase, language = $lang, \
            affiliate_assigned = $aff, assigned_to = $assigned, ninja_assigned = $ninja, \
            spouse_client_id = $sid, spouse_client_label = $slabel, \
            monitoring_agency = $ma, monitoring_username = $mu, monitoring_password = $mp, monitoring_token = $mt, \
            secret_key = $sk, portal_password = $pp, portal_enabled = $pe, \
            goal = $goal, notes = $notes, \
            yearly_income = $yi, housing_payment = $hp, debt_monthly_payments = $dmp, \
            report_date = $rd, \
            next_import_int = $ni, next_import_label = $nl, \
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
        .bind(("goal", goal))
        .bind(("notes", notes))
        .bind(("yi", yearly_income))
        .bind(("hp", housing_payment))
        .bind(("dmp", debt))
        .bind(("rd", report_date))
        .bind(("ni", ni))
        .bind(("nl", nl))
        .bind(("manualDays", manual_days_set))
        .bind(("manualToday", today_set))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let client = updated.ok_or(AppError::NotFound)?;

    let statuses = append_taxonomy(&state, "taxonomy.client_statuses", &status).await?;
    let phases = append_taxonomy(&state, "taxonomy.client_phases", &phase).await?;

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
    #[serde(default)] pub force_paid: bool,
    #[serde(default)] pub monitoring_agency: Option<String>,
    #[serde(default)] pub monitoring_username: Option<String>,
    #[serde(default)] pub monitoring_password: Option<String>,
    #[serde(default)] pub monitoring_token: Option<String>,
    #[serde(default)] pub secret_key: Option<String>,
}

pub async fn refresh_report(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Option<Json<RefreshReportBody>>,
) -> AppResult<impl IntoResponse> {
    let body = body.map(|Json(b)| b).unwrap_or_default();

    // Persist any credential overrides the form supplied before launching, so
    // the script can re-fetch the client by id and see fresh values.
    persist_refresh_overrides(&state, &id, &body).await?;

    let row = load_client_raw(&state, &id).await?;
    let camel = client_to_camel(&row);

    let agency_raw = camel
        .get("monitoringAgency")
        .and_then(Value::as_str)
        .unwrap_or("");
    let runner = agency_runner_type(agency_raw).ok_or_else(|| {
        AppError::BadRequest(
            "This client is not set to an IdentityIQ or SmartCredit browser-run service.".into(),
        )
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
    if body.monitoring_agency.is_some() { sets.push("monitoring_agency = $ma"); }
    if body.monitoring_username.is_some() { sets.push("monitoring_username = $mu"); }
    if body.monitoring_password.is_some() { sets.push("monitoring_password = $mp"); }
    if body.monitoring_token.is_some() { sets.push("monitoring_token = $mt"); }
    if body.secret_key.is_some() { sets.push("secret_key = $sk"); }

    let update = format!(
        "UPDATE type::thing('clients', $id) SET {} RETURN NONE",
        sets.join(", ")
    );
    let mut q = state.db.query(update).bind(("id", id.to_string()));
    if let Some(v) = &body.monitoring_agency { q = q.bind(("ma", v.clone())); }
    if let Some(v) = &body.monitoring_username { q = q.bind(("mu", v.clone())); }
    if let Some(v) = &body.monitoring_password { q = q.bind(("mp", v.clone())); }
    if let Some(v) = &body.monitoring_token { q = q.bind(("mt", v.clone())); }
    if let Some(v) = &body.secret_key { q = q.bind(("sk", v.clone())); }
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
        "monitoringToken": f("monitoring_token"),
        "secretKey": f("secret_key"),
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async fn load_client_raw(state: &AppState, id: &str) -> AppResult<Value> {
    let mut __resp = state
        .db
        .query("SELECT * FROM ONLY type::thing('clients', $id) LIMIT 1")
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
    let last = last_name.split_whitespace().next().unwrap_or("").to_lowercase();
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
    #[derive(Deserialize)] struct Row { value_json: String }
    let mut resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await.ok()?;
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
    state.db
        .query("UPSERT settings:[$k] SET setting_key = $k, value_json = $v, updated_at = time::now()")
        .bind(("k", key.to_string()))
        .bind(("v", payload))
        .await?;
    Ok(list)
}

fn default_statuses() -> Vec<String> {
    ["Lead", "Prospect", "Client", "Graduated", "Cancelled"]
        .iter().map(|s| s.to_string()).collect()
}

fn default_phases() -> Vec<String> {
    ["None", "Onboarding", "Round 1", "Round 2", "Round 3", "Monitoring"]
        .iter().map(|s| s.to_string()).collect()
}
