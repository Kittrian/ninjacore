//! Smaller standalone endpoints + a few stubs:
//!
//!   GET  /api/address-suggestions?q=        — Nominatim (configurable)
//!   POST /api/simulator/vantage             — STUB (Python what-if model)
//!   POST /api/client-statuses               — append to client taxonomy
//!   POST /api/client-phases                 — append to phase taxonomy
//!   POST /api/uploads/text-attachment       — store base64 text attachment
//!   POST /api/clients                       — create client
//!   POST /api/clients/import-csv            — STUB (large dedupe/import path)
//!   POST /api/report-sync/identityiq        — STUB (auth + scrape)
//!   POST /api/report-sync/smartcredit       — STUB (auth + scrape)

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

// ─── address suggestions (OpenStreetMap Nominatim) ────────────────────────

#[derive(Deserialize)]
pub struct AddressQuery {
    #[serde(default)] pub q: Option<String>,
}

pub async fn address_suggestions(Query(q): Query<AddressQuery>) -> AppResult<Json<Value>> {
    let needle = q.q.unwrap_or_default();
    let needle = needle.trim();
    if needle.len() < 3 {
        return Ok(Json(json!({ "suggestions": [] })));
    }
    let base = std::env::var("ADDRESS_SUGGEST_URL")
        .unwrap_or_else(|_| "https://nominatim.openstreetmap.org/search".into());
    let ua = std::env::var("ADDRESS_SUGGEST_UA")
        .unwrap_or_else(|_| "ninjacore/0.1 (contact: admin@ninjadispute.com)".into());

    let client = crate::http::shared();
    let resp = client
        .get(&base)
        .query(&[
            ("q", needle),
            ("format", "json"),
            ("addressdetails", "1"),
            ("limit", "6"),
            ("countrycodes", "us"),
        ])
        .header("User-Agent", ua)
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let arr: Vec<Value> = resp.json().await.unwrap_or_default();
    let suggestions: Vec<Value> = arr
        .into_iter()
        .map(|entry| {
            let display = entry["display_name"].as_str().unwrap_or("").to_string();
            json!({
                "label": display,
                "lat": entry["lat"].as_str().unwrap_or(""),
                "lon": entry["lon"].as_str().unwrap_or(""),
                "address": entry["address"].clone(),
            })
        })
        .collect();
    Ok(Json(json!({ "suggestions": suggestions })))
}

// ─── vantage simulator (STUB) ─────────────────────────────────────────────

pub async fn vantage(_user: AuthUser) -> AppResult<Json<Value>> {
    Err(AppError::NotImplemented(
        "simulator/vantage runs an external Python what-if model \
         (runVantageSimulation). Port the Python entrypoint as a sibling \
         binary or rewrite the scoring model in Rust before wiring this route."
            .into(),
    ))
}

// ─── client taxonomy POSTs ────────────────────────────────────────────────

const STATUSES_KEY: &str = "taxonomy.client_statuses";
const PHASES_KEY: &str = "taxonomy.client_phases";

#[derive(Deserialize)]
pub struct TaxonomyBody {
    #[serde(default)] pub value: Option<String>,
}

async fn append_taxonomy(state: &AppState, key: &str, value: &str) -> AppResult<Vec<String>> {
    #[derive(Deserialize)] struct Row { value_json: String }
    let mut __resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut __resp, 0)?;
    let mut list: Vec<String> = row
        .and_then(|r| serde_json::from_str(&r.value_json).ok())
        .unwrap_or_default();
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

pub async fn add_status(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<TaxonomyBody>,
) -> AppResult<Json<Value>> {
    let v = body.value.ok_or_else(|| AppError::BadRequest("value required".into()))?;
    let list = append_taxonomy(&state, STATUSES_KEY, &v).await?;
    Ok(Json(json!({ "ok": true, "statuses": list })))
}

pub async fn add_phase(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<TaxonomyBody>,
) -> AppResult<Json<Value>> {
    let v = body.value.ok_or_else(|| AppError::BadRequest("value required".into()))?;
    let list = append_taxonomy(&state, PHASES_KEY, &v).await?;
    Ok(Json(json!({ "ok": true, "phases": list })))
}

// ─── uploads/text-attachment ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct TextAttachmentBody {
    #[serde(default, rename = "clientId")] pub client_id: Option<String>,
    #[serde(default)] pub filename: Option<String>,
    #[serde(default, rename = "contentType")] pub content_type: Option<String>,
    #[serde(default)] pub text: Option<String>,
}

pub async fn upload_text_attachment(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<TextAttachmentBody>,
) -> AppResult<Json<Value>> {
    let client_id = body.client_id.ok_or_else(|| AppError::BadRequest("clientId required".into()))?;
    let filename = body.filename.unwrap_or_else(|| "attachment.txt".into());
    let content_type = body.content_type.unwrap_or_else(|| "text/plain".into());
    let text = body.text.unwrap_or_default();
    if text.is_empty() {
        return Err(AppError::BadRequest("text body is empty".into()));
    }
    let bytes = text.as_bytes().len();
    let id = uuid::Uuid::new_v4().to_string();
    state.db
        .query("CREATE attachment SET id = $id, client_id = $cid, filename = $fn, content_type = $ct, bytes = $b, text = $t, created_at = time::now()")
        .bind(("id", id.clone()))
        .bind(("cid", client_id.clone()))
        .bind(("fn", filename.clone()))
        .bind(("ct", content_type.clone()))
        .bind(("b", bytes as i64))
        .bind(("t", text))
        .await?;
    Ok(Json(json!({
        "ok": true,
        "attachment": { "id": id, "clientId": client_id, "filename": filename, "contentType": content_type, "bytes": bytes }
    })))
}

// ─── clients POST (create) ────────────────────────────────────────────────

#[derive(Deserialize, Serialize, Default)]
pub struct NewClient {
    #[serde(default, rename = "firstName")] pub first_name: String,
    #[serde(default, rename = "lastName")] pub last_name: String,
    #[serde(default)] pub email: String,
    #[serde(default)] pub phone: String,
    #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub phase: Option<String>,
    #[serde(default)] pub address: String,
    #[serde(default)] pub dob: String,
    #[serde(default)] pub ssn: String,
    #[serde(default)] pub goal: String,
    #[serde(default)] pub notes: String,
    #[serde(flatten)] pub extra: serde_json::Map<String, Value>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
struct GhlIntegration {
    api_token: String,
    location_id: String,
}

fn extra_string(extra: &serde_json::Map<String, Value>, key: &str) -> String {
    extra.get(key)
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn parse_address_parts(raw: &str) -> (String, String, String, String) {
    let cleaned = raw.trim().replace('\n', ", ");
    if cleaned.is_empty() {
        return (String::new(), String::new(), String::new(), String::new());
    }
    if cleaned.contains('|') {
        let parts: Vec<String> = cleaned.split('|').map(|part| part.trim().trim_end_matches(',').to_string()).filter(|part| !part.is_empty()).collect();
        if parts.len() >= 2 {
            let street = parts[0].clone();
            let locality: Vec<String> = parts[1].split_whitespace().map(|part| part.to_string()).collect();
            if locality.len() >= 2 {
                let zip = locality.last().cloned().unwrap_or_default();
                let state = locality.get(locality.len().saturating_sub(2)).cloned().unwrap_or_default();
                let city = parts[1]
                    .replace(&format!(" {} {}", state, zip), "")
                    .trim()
                    .trim_end_matches(',')
                    .to_string();
                return (street, city, state, zip);
            }
            return (street, parts[1].clone(), String::new(), String::new());
        }
    }
    let segments: Vec<String> = cleaned.split(',').map(|part| part.trim().to_string()).filter(|part| !part.is_empty()).collect();
    if segments.len() >= 3 {
        let street = segments[..segments.len() - 2].join(", ");
        let city = segments[segments.len() - 2].clone();
        let state_zip: Vec<&str> = segments[segments.len() - 1].split_whitespace().collect();
        if state_zip.len() >= 2 {
            return (
                street,
                city,
                state_zip[0].trim().to_string(),
                state_zip[1].trim().to_string(),
            );
        }
        return (street, city, segments[segments.len() - 1].clone(), String::new());
    }
    (cleaned, String::new(), String::new(), String::new())
}

fn build_ghl_note(body: &NewClient) -> String {
    let monitoring_agency = extra_string(&body.extra, "monitoringAgency");
    let monitoring_username = extra_string(&body.extra, "monitoringUsername");
    let monitoring_password = extra_string(&body.extra, "monitoringPassword");
    let secret_key = extra_string(&body.extra, "secretKey");
    let portal_password = extra_string(&body.extra, "portalPassword");

    [
        format!("DOB : {}", body.dob.trim()),
        format!("SSN : {}", body.ssn.trim()),
        format!("Monitoring = {}", monitoring_agency),
        if monitoring_username.is_empty() { String::new() } else { format!("Monitoring Username : {}", monitoring_username) },
        if monitoring_password.is_empty() { String::new() } else { format!("Monitoring Password : {}", monitoring_password) },
        if secret_key.is_empty() { String::new() } else { format!("Secret Key : {}", secret_key) },
        if portal_password.is_empty() { String::new() } else { format!("Portal Password : {}", portal_password) },
        if body.notes.trim().is_empty() { String::new() } else { format!("Notes : {}", body.notes.trim()) },
    ]
    .into_iter()
    .map(|line| line.trim().to_string())
    .filter(|line| !line.is_empty())
    .collect::<Vec<String>>()
    .join("\n")
}

async fn load_ghl_integration(state: &AppState) -> AppResult<GhlIntegration> {
    #[derive(Deserialize)]
    struct Row {
        value_json: String,
    }

    let mut resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = 'integration.gohighlevel' LIMIT 1")
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut resp, 0)?;
    let integration = row
        .and_then(|value| serde_json::from_str::<GhlIntegration>(&value.value_json).ok())
        .unwrap_or_default();
    Ok(integration)
}

async fn sync_client_to_gohighlevel(state: &AppState, created: &Value, body: &NewClient) -> AppResult<Value> {
    let integration = load_ghl_integration(state).await?;
    let api_token = integration.api_token.trim().to_string();
    let location_id = if integration.location_id.trim().is_empty() {
        "BTUVP8XCPh6i633PAvD4".to_string()
    } else {
        integration.location_id.trim().to_string()
    };

    if api_token.is_empty() {
        return Ok(json!({
            "attempted": false,
            "reason": "missing-api-token",
        }));
    }

    let (address1, city, state_code, postal_code) = parse_address_parts(&body.address);
    let client = crate::http::shared();
    let payload = json!({
        "firstName": body.first_name.trim(),
        "lastName": body.last_name.trim(),
        "email": body.email.trim(),
        "phone": body.phone.trim(),
        "locationId": location_id,
        "source": "Ninja Tools",
        "tags": ["Ninja Tools"],
        "address1": address1,
        "city": city,
        "state": state_code,
        "postalCode": postal_code,
        "dateOfBirth": body.dob.trim(),
        "ssn": body.ssn.trim(),
    });

    let response = client
        .post("https://services.leadconnectorhq.com/contacts/upsert")
        .header("accept", "application/json")
        .header("authorization", format!("Bearer {}", api_token))
        .header("content-type", "application/json")
        .header("version", "2023-02-21")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let status = response.status();
    let parsed: Value = response.json().await.unwrap_or_else(|_| json!({}));
    if !status.is_success() {
        return Ok(json!({
            "attempted": true,
            "ok": false,
            "status": status.as_u16(),
            "error": parsed.get("message").and_then(|v| v.as_str()).unwrap_or("GoHighLevel contact upsert failed."),
            "parsed": parsed,
        }));
    }

    let contact_id = parsed.get("contact")
        .and_then(|value| value.get("id"))
        .and_then(|value| value.as_str())
        .or_else(|| parsed.get("id").and_then(|value| value.as_str()))
        .unwrap_or("")
        .trim()
        .to_string();

    if !contact_id.is_empty() {
        if let Some(record_id) = created.get("id").and_then(|value| value.as_str()).map(|value| value.to_string()) {
            let _ = state.db
                .query("UPDATE type::thing($table, $id) SET external_client_id = $ghl, updated_at = time::now()")
                .bind(("table", "client"))
                .bind(("id", record_id.trim_start_matches("client:").to_string()))
                .bind(("ghl", contact_id.clone()))
                .await;
        }

        let note_body = build_ghl_note(body);
        if !note_body.is_empty() {
            let note_response = client
                .post(format!("https://services.leadconnectorhq.com/contacts/{}/notes", contact_id))
                .header("accept", "application/json")
                .header("authorization", format!("Bearer {}", api_token))
                .header("content-type", "application/json")
                .header("version", "2023-02-21")
                .json(&json!({
                    "body": note_body,
                    "userId": "",
                }))
                .send()
                .await
                .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
            let note_status = note_response.status();
            let note_parsed: Value = note_response.json().await.unwrap_or_else(|_| json!({}));
            if note_status.is_success() {
                return Ok(json!({
                    "attempted": true,
                    "ok": true,
                    "contactId": contact_id,
                    "locationId": location_id,
                    "note": {
                        "ok": true,
                        "status": note_status.as_u16(),
                        "parsed": note_parsed,
                    },
                }));
            }
            return Ok(json!({
                "attempted": true,
                "ok": true,
                "contactId": contact_id,
                "locationId": location_id,
                "note": {
                    "ok": false,
                    "status": note_status.as_u16(),
                    "parsed": note_parsed,
                },
            }));
        }
    }

    Ok(json!({
        "attempted": true,
        "ok": true,
        "contactId": contact_id,
        "locationId": location_id,
    }))
}

pub async fn create_client(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<NewClient>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.first_name.trim().is_empty() || body.last_name.trim().is_empty() {
        return Err(AppError::BadRequest("firstName and lastName are required".into()));
    }
    let first_name = body.first_name.clone();
    let last_name = body.last_name.clone();
    let email = body.email.clone();
    let phone = body.phone.clone();
    let address = body.address.clone();
    let dob = body.dob.clone();
    let ssn = body.ssn.clone();
    let goal = body.goal.clone();
    let notes = body.notes.clone();
    let extra = body.extra.clone();
    let status = body.status.clone().unwrap_or_else(|| "Client".into());
    let phase = body.phase.clone().unwrap_or_else(|| "None".into());
    let email_n = email.trim().to_lowercase();
    let phone_n: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

    let mut __resp = state.db
        .query("CREATE client SET \
            first_name = $fn, last_name = $ln, email = $email, phone = $phone, \
            email_n = $em, phone_n = $ph, \
            status = $status, phase = $phase, \
            address = $address, dob = $dob, ssn = $ssn, \
            goal = $goal, notes = $notes, extra = $extra, \
            created_at = time::now(), updated_at = time::now() \
            RETURN AFTER")
        .bind(("fn", first_name))
        .bind(("ln", last_name))
        .bind(("email", email))
        .bind(("phone", phone))
        .bind(("em", email_n))
        .bind(("ph", phone_n))
        .bind(("status", status))
        .bind(("phase", phase))
        .bind(("address", address))
        .bind(("dob", dob))
        .bind(("ssn", ssn))
        .bind(("goal", goal))
        .bind(("notes", notes))
        .bind(("extra", Value::Object(extra)))
        .await?;
    let created: Option<Value> = crate::db::take_one(&mut __resp, 0)?;
    let ghl_sync = if let Some(ref created_client) = created {
        sync_client_to_gohighlevel(&state, created_client, &body).await.unwrap_or_else(|error| {
            json!({
                "attempted": true,
                "ok": false,
                "error": error.to_string(),
            })
        })
    } else {
        json!({
            "attempted": false,
            "reason": "missing-created-record",
        })
    };
    Ok((StatusCode::CREATED, Json(json!({ "ok": true, "client": created, "gohighlevelSync": ghl_sync }))))
}

// ─── clients/import-csv ───────────────────────────────────────────────────
//
// Body shape (matches server.mjs — frontend parses the CSV and POSTs rows):
//   { "rows": [ { "firstName": "...", "lastName": "...", ... }, ... ] }
//
// Rows missing firstName or lastName are silently dropped. All accepted rows
// are inserted as fresh clients (server.mjs intentionally does NOT dedupe
// here — the frontend dedupe-vs-existing flow runs before this endpoint).
// Statuses/phases taxonomies are extended with any new values.

#[derive(Deserialize)]
pub struct ImportCsvBody {
    #[serde(default)]
    pub rows: Vec<serde_json::Map<String, Value>>,
}

pub async fn import_csv(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ImportCsvBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let mut prepared: Vec<Value> = Vec::with_capacity(body.rows.len());
    let mut statuses_seen: Vec<String> = Vec::new();
    let mut phases_seen: Vec<String> = Vec::new();
    let now_iso = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();
    let today = time::OffsetDateTime::now_utc()
        .date()
        .format(&time::format_description::well_known::Iso8601::DATE)
        .unwrap_or_default();

    for row in body.rows {
        let pick = |key: &str| -> String {
            row.get(key).and_then(|v| v.as_str()).unwrap_or("").trim().to_string()
        };
        let pick_alt = |keys: &[&str]| -> String {
            for k in keys {
                let v = pick(k);
                if !v.is_empty() { return v; }
            }
            String::new()
        };

        let first_name = pick("firstName");
        let last_name = pick("lastName");
        if first_name.is_empty() || last_name.is_empty() {
            continue;
        }

        let email = pick("email");
        let phone = pick("phone");
        let dob = normalize_dob(&pick_alt(&["dob", "DOB"]));
        let ssn = normalize_ssn(&pick_alt(&["ssn", "SSN"]));
        let status = {
            let s = pick("status");
            if s.is_empty() { "Client".into() } else { s }
        };
        let phase = {
            let p = pick("phase");
            if p.is_empty() { "None".into() } else { p }
        };
        let next_import_int = pick("nextImportInt");
        let next_import_label = pick("nextImportLabel");
        let manual_days: Option<i64> = next_import_int.trim().parse().ok();

        // Synthetic composite ID — matches live `clients:<client_id>_<source_db>` shape.
        let synthetic = format!("csv_{}", uuid::Uuid::new_v4().simple());
        // Only fields that exist on the live SCHEMAFULL clients table.
        let _placeholder = placeholder_credit_report_html(&first_name, &last_name);
        let doc = json!({
            "client_id": synthetic.clone(),
            "source_db": "ninjatools",
            "owner_key": "admin",
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "dob": dob, "ssn": ssn,
            "status": status, "phase": phase,
            "monitoring_agency": "",
            "monitoring_username": "",
            "monitoring_password": "",
            "monitoring_token": "",
            "secret_key": "",
            "yearly_income": "",
            "housing_payment": "",
            "debt_monthly_payments": "",
            "goal": "",
            "notes": "",
            "report_date": pick("reportDate"),
            "next_import_int": next_import_int,
            "next_import_label": next_import_label,
            "next_import_mode": "manual",
            "manual_next_import_start_days": manual_days,
            "manual_next_import_set_date": today,
            "refresh_next_import_start_date": "",
            "created_at": now_iso,
            "updated_at": now_iso,
            "_rid": synthetic, // consumed below
        });
        if !statuses_seen.iter().any(|s| s.eq_ignore_ascii_case(doc["status"].as_str().unwrap_or(""))) {
            statuses_seen.push(doc["status"].as_str().unwrap_or("").to_string());
        }
        if !phases_seen.iter().any(|p| p.eq_ignore_ascii_case(doc["phase"].as_str().unwrap_or(""))) {
            phases_seen.push(doc["phase"].as_str().unwrap_or("").to_string());
        }
        prepared.push(doc);
    }

    if prepared.is_empty() {
        return Err(AppError::BadRequest("No valid clients were found in the CSV.".into()));
    }

    // Per-row create — each gets its synthetic composite record id via type::thing.
    for mut doc in prepared.iter().cloned() {
        let rid = doc.as_object_mut()
            .and_then(|o| o.remove("_rid"))
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| format!("csv_{}", uuid::Uuid::new_v4().simple()));
        state.db
            .query("CREATE type::thing('clients', $rid) CONTENT $doc RETURN NONE")
            .bind(("rid", rid))
            .bind(("doc", doc))
            .await?;
    }

    // Extend taxonomies (idempotent per server.mjs).
    let _ = extend_taxonomy(&state, "taxonomy.client_statuses", &statuses_seen).await;
    let _ = extend_taxonomy(&state, "taxonomy.client_phases", &phases_seen).await;

    let safe_clients: Vec<Value> = prepared.into_iter().map(safe_csv_client).collect();
    Ok((StatusCode::CREATED, Json(json!({
        "ok": true,
        "importedCount": safe_clients.len(),
        "clients": safe_clients,
    }))))
}

fn normalize_dob(raw: &str) -> String {
    let t = raw.trim();
    if t.is_empty() { return String::new(); }
    if t.len() == 10 && t.as_bytes()[4] == b'-' && t.as_bytes()[7] == b'-' { return t.to_string(); }
    if t.len() == 10 && (t.as_bytes()[2] == b'/' || t.as_bytes()[2] == b'-') {
        let (m, rest) = t.split_at(2);
        let (_s1, rest) = rest.split_at(1);
        let (d, rest) = rest.split_at(2);
        let (_s2, y) = rest.split_at(1);
        return format!("{y}-{m}-{d}");
    }
    t.to_string()
}

fn normalize_ssn(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 9 { return raw.trim().to_string(); }
    format!("{}-{}-{}", &digits[..3], &digits[3..5], &digits[5..])
}

fn placeholder_credit_report_html(first: &str, last: &str) -> String {
    format!(
        "<!DOCTYPE html><html><body><p>No HTML credit report has been uploaded yet for {first} {last}. \
         This client was imported via CSV.</p></body></html>"
    )
}

fn safe_csv_client(mut v: Value) -> Value {
    if let Some(obj) = v.as_object_mut() {
        obj.remove("monitoring_password");
        obj.remove("secret_key");
        if let Some(ssn) = obj.get("ssn").and_then(|s| s.as_str()) {
            let digits: String = ssn.chars().filter(|c| c.is_ascii_digit()).collect();
            if digits.len() >= 4 {
                obj.insert("ssn".into(), Value::String(format!("***-**-{}", &digits[digits.len()-4..])));
            }
        }
    }
    v
}

async fn extend_taxonomy(state: &AppState, key: &str, values: &[String]) -> AppResult<()> {
    if values.is_empty() { return Ok(()); }
    #[derive(Deserialize)] struct Row { value_json: String }
    let mut __resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut __resp, 0)?;
    let mut list: Vec<String> = row
        .and_then(|r| serde_json::from_str(&r.value_json).ok())
        .unwrap_or_default();
    for v in values {
        let t = v.trim();
        if t.is_empty() || list.iter().any(|x| x.eq_ignore_ascii_case(t)) { continue; }
        list.push(t.to_string());
    }
    let payload = serde_json::to_string(&list).unwrap_or("[]".into());
    state.db
        .query("UPSERT settings:[$k] SET setting_key = $k, value_json = $v, updated_at = time::now()")
        .bind(("k", key.to_string()))
        .bind(("v", payload))
        .await?;
    Ok(())
}

// ─── report-sync stubs ────────────────────────────────────────────────────

// ─── report-sync (receiver endpoints) ─────────────────────────────────────

#[derive(Deserialize)]
pub struct ReportSyncBody {
    #[serde(default, rename = "clientId")] pub client_id: Option<String>,
    #[serde(default, rename = "firstName")] pub first_name: Option<String>,
    #[serde(default, rename = "lastName")] pub last_name: Option<String>,
    #[serde(default)] pub email: Option<String>,
    #[serde(default, rename = "monitoringUsername")] pub monitoring_username: Option<String>,
    #[serde(default, rename = "monitoringPassword")] pub monitoring_password: Option<String>,
    #[serde(default, rename = "reportHtml")] pub report_html: Option<String>,
    #[serde(default, rename = "reportJson")] pub report_json: Option<Value>,
    #[serde(default, rename = "reportJsonRaw")] pub report_json_raw: Option<String>,
    #[serde(default, rename = "creditReportFileName")] pub credit_report_file_name: Option<String>,
    #[serde(default, rename = "creditReportSource")] pub credit_report_source: Option<String>,
    #[serde(default, rename = "creditReportSource")] pub monitoring_agency: Option<String>,
    #[serde(default, rename = "responseUrl")] pub response_url: Option<String>,
}

fn advance_client_phase(phase: &str) -> String {
    let raw = phase.trim();
    if let Some(caps) = regex::Regex::new(r"^phase\s+([1-7])$")
        .ok()
        .and_then(|re| re.captures_iter(raw).next())
    {
        if let Ok(num) = caps.get(1).unwrap().as_str().parse::<i32>() {
            if num >= 7 {
                return "Phase 7".to_string();
            }
            return format!("Phase {}", num + 1);
        }
    }
    if raw.is_empty() {
        "None".to_string()
    } else {
        raw.to_string()
    }
}

async fn find_client_for_sync(
    state: &AppState,
    client_id: &Option<String>,
    first_name: &Option<String>,
    last_name: &Option<String>,
    email: &Option<String>,
) -> AppResult<Option<serde_json::Value>> {
    if let Some(cid) = client_id.as_ref().filter(|c| !c.trim().is_empty()) {
        let mut __resp = state
            .db
            .query("SELECT * FROM clients WHERE id = $id LIMIT 1")
            .bind(("id", cid.clone()))
            .await?;
        if let Ok(Some(client)) = crate::db::take_one::<serde_json::Value>(&mut __resp, 0) {
            return Ok(Some(client));
        }
    }

    let fn_val = first_name.as_ref().map(|s| s.trim()).unwrap_or("").to_lowercase();
    let ln_val = last_name.as_ref().map(|s| s.trim()).unwrap_or("").to_lowercase();
    let em_val = email.as_ref().map(|s| s.trim().to_lowercase()).unwrap_or_default();

    if !fn_val.is_empty() && !ln_val.is_empty() {
        let mut __resp = state
            .db
            .query("SELECT * FROM clients WHERE first_name_lc = $fn AND last_name_lc = $ln LIMIT 1")
            .bind(("fn", fn_val.clone()))
            .bind(("ln", ln_val.clone()))
            .await?;
        if let Ok(Some(client)) = crate::db::take_one::<serde_json::Value>(&mut __resp, 0) {
            return Ok(Some(client));
        }
    }

    if !em_val.is_empty() {
        let mut __resp = state
            .db
            .query("SELECT * FROM clients WHERE email_lc = $e LIMIT 1")
            .bind(("e", em_val))
            .await?;
        if let Ok(Some(client)) = crate::db::take_one::<serde_json::Value>(&mut __resp, 0) {
            return Ok(Some(client));
        }
    }

    Ok(None)
}

#[derive(Serialize)]
struct ReportHistoryItem {
    id: String,
    #[serde(rename = "clientId")]
    client_id: String,
    source: String,
    #[serde(rename = "monitoringAgency")]
    monitoring_agency: String,
    #[serde(rename = "reportDate")]
    report_date: String,
    #[serde(rename = "reportFileName")]
    report_file_name: String,
    #[serde(rename = "responseUrl")]
    response_url: String,
    #[serde(rename = "createdAt")]
    created_at: String,
}

async fn list_report_history(state: &AppState, client_id: &str) -> AppResult<Vec<ReportHistoryItem>> {
    #[derive(Deserialize)]
    struct ReportRow {
        id: String,
        client_id: String,
        source: String,
        monitoring_agency: String,
        report_date: String,
        report_file_name: String,
        response_url: String,
        created_at: String,
    }
    let mut __resp = state
        .db
        .query("SELECT id, client_id, source, monitoring_agency, report_date, report_file_name, response_url, created_at FROM reports WHERE client_id = $cid ORDER BY created_at DESC")
        .bind(("cid", client_id.to_string()))
        .await?;
    let rows: Vec<ReportRow> = crate::db::take_many(&mut __resp, 0)?;
    Ok(rows
        .into_iter()
        .map(|r| ReportHistoryItem {
            id: r.id,
            client_id: r.client_id,
            source: r.source,
            monitoring_agency: r.monitoring_agency,
            report_date: r.report_date,
            report_file_name: r.report_file_name,
            response_url: r.response_url,
            created_at: r.created_at,
        })
        .collect())
}

fn get_today_iso_date() -> String {
    time::OffsetDateTime::now_utc()
        .date()
        .to_string()
}

pub async fn report_sync_iiq(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ReportSyncBody>,
) -> AppResult<Json<Value>> {
    let client_id = body.client_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let first_name = body.first_name.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let last_name = body.last_name.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let email = body.email.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());

    if client_id.is_none() && (first_name.is_none() || last_name.is_none()) {
        return Err(AppError::BadRequest(
            "First name and last name are required for report sync.".into(),
        ));
    }

    let client = find_client_for_sync(&state, &body.client_id, &body.first_name, &body.last_name, &body.email)
        .await?
        .ok_or_else(|| AppError::BadRequest("No matching client was found for this IdentityIQ report sync.".into()))?;

    let client_id_str = client
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Other(anyhow::anyhow!("client id missing")))?;

    let client_phase = client
        .get("phase")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let report_json = if let Some(raw) = &body.report_json_raw {
        raw.clone()
    } else if let Some(json_val) = &body.report_json {
        serde_json::to_string(json_val).unwrap_or_default()
    } else {
        String::new()
    };

    if report_json.trim().is_empty() {
        return Err(AppError::BadRequest(
            "IdentityIQ sync refused: report JSON is missing or invalid.".into(),
        ));
    }

    let report_html = body.report_html.unwrap_or_default();
    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();
    let report_date = get_today_iso_date();
    let monitoring_agency = body.monitoring_agency.unwrap_or_else(|| "IdentityIQ".to_string());

    let report_file_name = body
        .credit_report_file_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("identityiq-report-{}.html", report_date));

    // Schema requires non-null report_id (separate from the record id).
    // Mirror the record id into report_id so the row is uniquely addressable.
    let report_record_id = format!("{}_{}", client_id_str, uuid::Uuid::new_v4().simple());
    state
        .db
        .query(
            "CREATE reports SET \
             id = $id, report_id = $rid, report_type = $src, client_id = $cid, source = $src, monitoring_agency = $mag, \
             report_date = $rd, report_file_name = $rfn, report_html = $rh, \
             report_json = $rj, response_url = $rurl, created_at = $ca, source_db = 'ninjatools'",
        )
        .bind(("id", report_record_id.clone()))
        .bind(("rid", report_record_id))
        .bind(("cid", client_id_str.clone()))
        .bind(("src", "identityiq-json"))
        .bind(("mag", monitoring_agency.clone()))
        .bind(("rd", report_date.clone()))
        .bind(("rfn", report_file_name))
        .bind(("rh", report_html))
        .bind(("rj", report_json.clone()))
        .bind(("rurl", body.response_url.unwrap_or_default()))
        .bind(("ca", now.clone()))
        .await?;

    state
        .db
        .query(
            "UPDATE clients SET \
             report_date = $rd, monitoring_agency = $mag, monitoring_username = $mu, \
             last_synced_at = $lsa, next_import_int = '', next_import_label = '', \
             next_import_mode = 'refresh-success', refresh_next_import_start_date = $risd, \
             phase = $ph \
             WHERE id = $cid",
        )
        .bind(("rd", report_date.clone()))
        .bind(("mag", monitoring_agency.clone()))
        .bind(("mu", body.monitoring_username.unwrap_or_default()))
        .bind(("lsa", now))
        .bind(("risd", report_date))
        .bind(("ph", advance_client_phase(&client_phase)))
        .bind(("cid", client_id_str.clone()))
        .await?;

    // Bridge: mirror this report into Flow 1 storage on api.ninjadispute.com so
    // the Vue letter generator sees the latest report immediately. Fire-and-forget.
    tokio::spawn(forward_report_to_flow1_api(
        client_id_str.clone(),
        monitoring_agency,
        report_json.clone(),
    ));

    let history = list_report_history(&state, &client_id_str).await?;

    let mut __resp = state
        .db
        .query("SELECT * FROM clients WHERE id = $id LIMIT 1")
        .bind(("id", client_id_str))
        .await?;
    let updated_client: Value = crate::db::take_one(&mut __resp, 0)?
        .unwrap_or(json!({}));

    Ok(Json(json!({
        "ok": true,
        "jsonLength": report_json.len(),
        "client": updated_client,
        "history": history,
    })))
}

pub async fn report_sync_sc(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ReportSyncBody>,
) -> AppResult<Json<Value>> {
    let client_id = body.client_id.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let first_name = body.first_name.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let last_name = body.last_name.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let email = body.email.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());
    let monitoring_username = body.monitoring_username.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty());

    let report_json = if let Some(raw) = &body.report_json_raw {
        raw.clone()
    } else if let Some(json_val) = &body.report_json {
        serde_json::to_string(json_val).unwrap_or_default()
    } else {
        String::new()
    };

    if report_json.trim().is_empty() {
        return Err(AppError::BadRequest(
            "SmartCredit report sync requires JSON report data.".into(),
        ));
    }

    if client_id.is_none() && (first_name.is_none() || last_name.is_none()) && monitoring_username.is_none() {
        return Err(AppError::BadRequest(
            "A matching SmartCredit sync needs either first/last name or a monitoring username.".into(),
        ));
    }

    let client = find_client_for_sync(&state, &body.client_id, &body.first_name, &body.last_name, &body.email)
        .await?
        .ok_or_else(|| AppError::BadRequest(format!(
            "No matching client was found for this SmartCredit report sync using monitoring username \"{}\"{}",
            monitoring_username.unwrap_or("[missing]"),
            if first_name.is_some() || last_name.is_some() {
                format!(
                    " and name \"{} {}\"",
                    first_name.unwrap_or(""),
                    last_name.unwrap_or("")
                )
            } else {
                String::new()
            }
        )))?;

    let client_id_str = client
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Other(anyhow::anyhow!("client id missing")))?;

    let client_phase = client
        .get("phase")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();
    let report_date = get_today_iso_date();
    let monitoring_agency = body
        .monitoring_agency
        .unwrap_or_else(|| "SmartCredit".to_string());

    let report_file_name = body
        .credit_report_file_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("smartcredit-report-{}.json", report_date));

    let report_record_id = format!("{}_{}", client_id_str, uuid::Uuid::new_v4().simple());
    state
        .db
        .query(
            "CREATE reports SET \
             id = $id, report_id = $rid, report_type = $src, client_id = $cid, source = $src, monitoring_agency = $mag, \
             report_date = $rd, report_file_name = $rfn, report_json = $rj, \
             response_url = $rurl, created_at = $ca, source_db = 'ninjatools'",
        )
        .bind(("id", report_record_id.clone()))
        .bind(("rid", report_record_id))
        .bind(("cid", client_id_str.clone()))
        .bind(("src", "smartcredit-json"))
        .bind(("mag", monitoring_agency.clone()))
        .bind(("rd", report_date.clone()))
        .bind(("rfn", report_file_name))
        .bind(("rj", report_json.clone()))
        .bind(("rurl", body.response_url.unwrap_or_default()))
        .bind(("ca", now.clone()))
        .await?;

    state
        .db
        .query(
            "UPDATE clients SET \
             report_date = $rd, monitoring_agency = $mag, monitoring_username = $mu, \
             last_synced_at = $lsa, next_import_int = '', next_import_label = '', \
             next_import_mode = 'refresh-success', refresh_next_import_start_date = $risd, \
             phase = $ph \
             WHERE id = $cid",
        )
        .bind(("rd", report_date.clone()))
        .bind(("mag", monitoring_agency.clone()))
        .bind(("mu", body.monitoring_username.unwrap_or_default()))
        .bind(("lsa", now))
        .bind(("risd", report_date))
        .bind(("ph", advance_client_phase(&client_phase)))
        .bind(("cid", client_id_str.clone()))
        .await?;

    // Bridge: mirror this report into Flow 1 storage on api.ninjadispute.com.
    tokio::spawn(forward_report_to_flow1_api(
        client_id_str.clone(),
        monitoring_agency,
        report_json,
    ));

    let history = list_report_history(&state, &client_id_str).await?;

    let mut __resp = state
        .db
        .query("SELECT * FROM clients WHERE id = $id LIMIT 1")
        .bind(("id", client_id_str))
        .await?;
    let updated_client: Value = crate::db::take_one(&mut __resp, 0)?
        .unwrap_or(json!({}));

    Ok(Json(json!({
        "ok": true,
        "client": updated_client,
        "history": history,
    })))
}

// ─── Flow 1 bridge — forward refresh-report results to api.ninjadispute.com ───
//
// After ninjacore writes its own Flow 2 snapshot row, this helper POSTs the
// same parsed report (as a JSON array of bureau payloads) to the Express API
// on Contabo so all Flow 1 stores (Surreal reports:{cid}, report_data_entries,
// disk JSONL, R2 mirror) get updated too. The Vue SPA's letter generator
// reads from Flow 1, so this keeps both UIs in sync.
//
// Fire-and-forget: failures are logged, never propagated to the user-facing
// HTTP response. The Flow 2 snapshot row stays even if this fails.
pub async fn forward_report_to_flow1_api(
    client_id_full: String,
    monitoring_agency: String,
    report_json_str: String,
) {
    // Strip the "clients:" prefix — Express expects numeric clientId.
    let cid_numeric = client_id_full
        .split(':')
        .next_back()
        .unwrap_or(&client_id_full)
        .to_string();

    let api_base = std::env::var("API_INTERNAL_BASE")
        .unwrap_or_else(|_| "http://100.79.226.47:3003".to_string());
    let token = match std::env::var("INTERNAL_SYNC_TOKEN") {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            tracing::warn!("Flow 1 bridge skipped for client {}: INTERNAL_SYNC_TOKEN unset", cid_numeric);
            return;
        }
    };

    // Parse the report JSON string back into a Value so the api receives
    // structured data, not a string.
    let report_json: serde_json::Value = match serde_json::from_str(&report_json_str) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("Flow 1 bridge for client {} skipped — unparseable report JSON: {}", cid_numeric, e);
            return;
        }
    };

    let body = json!({
        "clientId": cid_numeric,
        "monitoringAgency": monitoring_agency,
        "reportJson": report_json,
    });

    let url = format!("{}/internal/report-sync", api_base.trim_end_matches('/'));
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Flow 1 bridge: reqwest builder failed for client {}: {}", cid_numeric, e);
            return;
        }
    };

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            let txt = resp.text().await.unwrap_or_default();
            if status.is_success() {
                tracing::info!("Flow 1 bridge ok for client {}: {}", cid_numeric, txt);
            } else {
                tracing::warn!("Flow 1 bridge non-200 for client {}: HTTP {} {}", cid_numeric, status, txt);
            }
        }
        Err(e) => {
            tracing::warn!("Flow 1 bridge send failed for client {}: {}", cid_numeric, e);
        }
    }
}
