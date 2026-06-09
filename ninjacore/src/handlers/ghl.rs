//! GoHighLevel inbound webhook.
//!
//! POST /api/integrations/gohighlevel/webhook
//!
//! Auth: `webhookKey` from `integration.gohighlevel` settings, accepted via
//! `?key=`, `x-ghl-key`, or `Authorization: Bearer <key>`. Public route (no
//! AuthUser) — GHL won't have a session cookie.
//!
//! Behavior matches server.mjs: extract contact payload from common GHL
//! shapes, then find-or-create a `client` record using a priority chain
//! (ghl_contact_id → email → phone → first+last+contact match).

use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Deserialize, Default)]
pub struct KeyQuery {
    #[serde(default)]
    pub key: Option<String>,
}

#[derive(Default, Debug)]
struct GhlPayload {
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    status: Option<String>,
    monitoring_agency: String,
    monitoring_username: String,
    monitoring_password: String,
    yearly_income: String,
    housing_payment: String,
    debt_monthly_payments: String,
    ghl_contact_id: String,
    ghl_location_id: String,
    source: String,
    goal: String,
    notes: String,
}

pub async fn webhook(
    State(state): State<AppState>,
    Query(q): Query<KeyQuery>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let required_key = load_ghl_webhook_key(&state).await?;
    let provided = q
        .key
        .clone()
        .or_else(|| {
            headers
                .get("x-ghl-key")
                .and_then(|v| v.to_str().ok().map(|s| s.to_string()))
        })
        .or_else(|| {
            headers
                .get(axum::http::header::AUTHORIZATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.strip_prefix("Bearer "))
                .map(|s| s.to_string())
        })
        .unwrap_or_default();

    if !required_key.is_empty() && provided.trim() != required_key {
        return Err(AppError::Unauthorized);
    }

    let payload = extract_payload(&body);
    if payload.first_name.is_empty() || payload.last_name.is_empty() {
        return Err(AppError::BadRequest(
            "GoHighLevel payload must include at least a first and last name.".into(),
        ));
    }

    let email_n = normalize_lookup(&payload.email);
    let phone_n = normalize_phone(&payload.phone);
    let ghl_id_n = normalize_lookup(&payload.ghl_contact_id);

    // Priority chain matched on the fly (live schema has no normalized index fields).
    // Stored matches: external_client_id holds GHL contact id; email/phone normalized via string::lowercase / regex.
    let mut matched_by = "new";
    let mut existing: Option<Value> = None;

    if !ghl_id_n.is_empty() {
        existing = state
            .db
            .query("SELECT * FROM clients WHERE external_client_id_lc = $v LIMIT 1")
            .bind(("v", ghl_id_n.clone()))
            .await?
            .take(0)?;
        if existing.is_some() {
            matched_by = "ghlContactId";
        }
    }
    if existing.is_none() && !email_n.is_empty() {
        existing = state
            .db
            .query("SELECT * FROM clients WHERE email_lc = $v LIMIT 1")
            .bind(("v", email_n.clone()))
            .await?
            .take(0)?;
        if existing.is_some() {
            matched_by = "email";
        }
    }
    if existing.is_none() && !phone_n.is_empty() {
        // Strip non-digits from stored phone with string::replace_all.
        existing = state
            .db
            .query("SELECT * FROM clients WHERE string::replace(phone, /[^0-9]/, '') = $v LIMIT 1")
            .bind(("v", phone_n.clone()))
            .await?
            .take(0)?;
        if existing.is_some() {
            matched_by = "phone";
        }
    }
    if existing.is_none() {
        let fn_n = normalize_lookup(&payload.first_name);
        let ln_n = normalize_lookup(&payload.last_name);
        if !fn_n.is_empty() && !ln_n.is_empty() {
            existing = state
                .db
                .query(
                    "SELECT * FROM clients WHERE \
                        first_name_lc = $fn AND \
                        last_name_lc = $ln AND \
                        (email_lc = $em OR string::replace(phone, /[^0-9]/, '') = $ph) \
                        LIMIT 1",
                )
                .bind(("fn", fn_n))
                .bind(("ln", ln_n))
                .bind(("em", email_n.clone()))
                .bind(("ph", phone_n.clone()))
                .await?
                .take(0)?;
            if existing.is_some() {
                matched_by = "name+contact";
            }
        }
    }

    let next_status = payload.status.clone().unwrap_or_else(|| {
        existing
            .as_ref()
            .and_then(|c| c["status"].as_str())
            .unwrap_or("Lead")
            .to_string()
    });

    let (status_code, action) = if existing.is_some() {
        (StatusCode::OK, "updated")
    } else {
        (StatusCode::CREATED, "created")
    };

    // Match server.mjs schema: only bind fields that exist on the live SCHEMAFULL `clients` table.
    // GHL contact id lives in `external_client_id`. New records get source_db='gohighlevel'
    // and a synthetic client_id so the composite record id stays unique.
    let saved: Option<Value> = if let Some(ref ex) = existing {
        let ex_id = ex.get("id").cloned().unwrap_or(Value::Null);
        state
            .db
            .query(
                "UPDATE $rid SET \
                first_name = $fn, last_name = $ln, email = $email, phone = $phone, \
                external_client_id = $ghl_raw, \
                status = $status, \
                monitoring_agency = $ma, monitoring_username = $mu, monitoring_password = $mp, \
                yearly_income = $yi, housing_payment = $hp, debt_monthly_payments = $dmp, \
                goal = $goal, notes = $notes, \
                updated_at = time::now() \
                RETURN AFTER",
            )
            .bind(("rid", ex_id))
            .bind(("fn", payload.first_name.clone()))
            .bind(("ln", payload.last_name.clone()))
            .bind(("email", payload.email.clone()))
            .bind(("phone", payload.phone.clone()))
            .bind(("ghl_raw", payload.ghl_contact_id.clone()))
            .bind(("status", next_status))
            .bind(("ma", payload.monitoring_agency.clone()))
            .bind(("mu", payload.monitoring_username.clone()))
            .bind(("mp", payload.monitoring_password.clone()))
            .bind(("yi", payload.yearly_income.clone()))
            .bind(("hp", payload.housing_payment.clone()))
            .bind(("dmp", payload.debt_monthly_payments.clone()))
            .bind(("goal", payload.goal.clone()))
            .bind(("notes", payload.notes.clone()))
            .await?
            .take(0)?
    } else {
        // Synthetic client_id (random) namespaced 'gohighlevel' so it never collides with
        // the api.ninjadispute.com mirror's `<num>_ninjatools` ids.
        let synthetic = format!("ghl_{}", uuid::Uuid::new_v4().simple());
        state
            .db
            .query(
                "CREATE type::thing('clients', $rid) SET \
                client_id = $cid, source_db = 'gohighlevel', owner_key = 'admin', \
                first_name = $fn, last_name = $ln, email = $email, phone = $phone, \
                external_client_id = $ghl_raw, \
                status = $status, phase = 'None', \
                monitoring_agency = $ma, monitoring_username = $mu, monitoring_password = $mp, \
                yearly_income = $yi, housing_payment = $hp, debt_monthly_payments = $dmp, \
                goal = $goal, notes = $notes, \
                created_at = time::now(), updated_at = time::now() \
                RETURN AFTER",
            )
            .bind(("rid", synthetic.clone()))
            .bind(("cid", synthetic))
            .bind(("fn", payload.first_name.clone()))
            .bind(("ln", payload.last_name.clone()))
            .bind(("email", payload.email.clone()))
            .bind(("phone", payload.phone.clone()))
            .bind(("ghl_raw", payload.ghl_contact_id.clone()))
            .bind(("status", next_status))
            .bind(("ma", payload.monitoring_agency.clone()))
            .bind(("mu", payload.monitoring_username.clone()))
            .bind(("mp", payload.monitoring_password.clone()))
            .bind(("yi", payload.yearly_income.clone()))
            .bind(("hp", payload.housing_payment.clone()))
            .bind(("dmp", payload.debt_monthly_payments.clone()))
            .bind(("goal", payload.goal.clone()))
            .bind(("notes", payload.notes.clone()))
            .await?
            .take(0)?
    };
    let _ = (email_n, phone_n, ghl_id_n); // bindings consumed above; suppress warnings

    let client = saved.unwrap_or(json!({}));

    Ok((
        status_code,
        Json(json!({
            "ok": true,
            "action": action,
            "client": safe_client(&client),
            "matchedBy": matched_by,
        })),
    ))
}

async fn load_ghl_webhook_key(state: &AppState) -> AppResult<String> {
    #[derive(Deserialize)]
    struct Row {
        value_json: String,
    }
    let mut __resp = state
        .db
        .query(
            "SELECT value_json FROM settings WHERE setting_key = 'integration.gohighlevel' LIMIT 1",
        )
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut __resp, 0)?;
    let val: Value = row
        .and_then(|r| serde_json::from_str(&r.value_json).ok())
        .unwrap_or(json!({}));
    Ok(val["webhookKey"].as_str().unwrap_or("").trim().to_string())
}

fn normalize_lookup(s: &str) -> String {
    s.trim().to_lowercase()
}

fn normalize_phone(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_digit()).collect()
}

fn safe_client(v: &Value) -> Value {
    // Strip sensitive fields before echoing back.
    let mut out = v.clone();
    if let Some(obj) = out.as_object_mut() {
        obj.remove("monitoring_password");
    }
    out
}

/// Extract fields from common GHL contact payload shapes.
fn extract_payload(body: &Value) -> GhlPayload {
    let pick = |paths: &[&[&str]]| -> String {
        for path in paths {
            let mut cur = body;
            let mut ok = true;
            for key in *path {
                if let Some(next) = cur.get(*key) {
                    cur = next;
                } else {
                    ok = false;
                    break;
                }
            }
            if ok {
                if let Some(s) = cur.as_str() {
                    let t = s.trim();
                    if !t.is_empty() {
                        return t.to_string();
                    }
                }
            }
        }
        String::new()
    };

    let custom = |label: &str| -> String {
        // GHL custom fields are commonly under contact.customField[] {name, value} or .customFields
        let arrays = [
            body.get("customField"),
            body.get("customFields"),
            body.get("contact").and_then(|c| c.get("customField")),
            body.get("contact").and_then(|c| c.get("customFields")),
        ];
        for arr in arrays.into_iter().flatten() {
            if let Some(items) = arr.as_array() {
                for item in items {
                    let name = item
                        .get("name")
                        .or_else(|| item.get("fieldKey"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if name.eq_ignore_ascii_case(label) {
                        if let Some(s) = item.get("value").and_then(|v| v.as_str()) {
                            return s.trim().to_string();
                        }
                    }
                }
            }
        }
        String::new()
    };

    GhlPayload {
        first_name: pick(&[
            &["firstName"],
            &["first_name"],
            &["contact", "firstName"],
            &["contact", "first_name"],
        ]),
        last_name: pick(&[
            &["lastName"],
            &["last_name"],
            &["contact", "lastName"],
            &["contact", "last_name"],
        ]),
        email: pick(&[&["email"], &["contact", "email"]]),
        phone: pick(&[&["phone"], &["contact", "phone"]]),
        status: {
            let s = pick(&[&["status"], &["contact", "status"]]);
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        },
        monitoring_agency: custom("monitoringAgency"),
        monitoring_username: custom("monitoringUsername"),
        monitoring_password: custom("monitoringPassword"),
        yearly_income: custom("yearlyIncome"),
        housing_payment: custom("housingPayment"),
        debt_monthly_payments: custom("debtMonthlyPayments"),
        ghl_contact_id: pick(&[&["contactId"], &["contact_id"], &["id"], &["contact", "id"]]),
        ghl_location_id: pick(&[
            &["locationId"],
            &["location_id"],
            &["contact", "locationId"],
        ]),
        source: pick(&[&["source"], &["contact", "source"]]),
        goal: custom("goal"),
        notes: pick(&[&["notes"], &["contact", "notes"]]),
    }
}
