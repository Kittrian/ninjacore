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

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
struct DisputefoxIntegration {
    webhook_key: String,
    airtable_token: String,
    airtable_base_id: String,
    airtable_table_id: String,
    google_access_token: String,
    google_contacts_enabled: Option<bool>,
}

#[derive(Default, Debug, Clone)]
struct IncomingClient {
    first_name: String,
    last_name: String,
    email: String,
    phone: String,
    status: String,
    phase: String,
    street: String,
    city: String,
    state: String,
    zip: String,
    address: String,
    dob: String,
    ssn: String,
    goal: String,
    notes: String,
    monitoring_agency: String,
    monitoring_username: String,
    monitoring_password: String,
    secret_key: String,
    portal_password: String,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
struct GhlIntegration {
    api_token: String,
    location_id: String,
}

fn get_path<'a>(root: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = root;
    for key in path {
        current = current.get(*key)?;
    }
    Some(current)
}

fn pick_string(root: &Value, paths: &[&[&str]]) -> String {
    for path in paths {
        if let Some(value) = get_path(root, path) {
            if let Some(text) = value.as_str() {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            } else if value.is_number() || value.is_boolean() {
                let text = value.to_string();
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    String::new()
}

fn normalize_phone_ten(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() == 11 && digits.starts_with('1') {
        return digits[1..].to_string();
    }
    if digits.len() >= 10 {
        return digits[digits.len().saturating_sub(10)..].to_string();
    }
    digits
}

fn normalize_ssn(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() == 9 {
        format!("{}-{}-{}", &digits[..3], &digits[3..5], &digits[5..])
    } else {
        raw.trim().to_string()
    }
}

fn normalize_dob_mmddyyyy(raw: &str) -> String {
    let value = raw.trim();
    if value.is_empty() {
        return String::new();
    }
    let digits_only = value.chars().filter(|c| c.is_ascii_digit()).collect::<String>();
    if digits_only.len() == 8 {
        if value.starts_with("19") || value.starts_with("20") || value.get(4..5) == Some("-") {
            return format!("{}-{}-{}", &digits_only[4..6], &digits_only[6..8], &digits_only[..4]);
        }
    }
    let separators: Vec<&str> = value.split(['/', '-']).collect();
    if separators.len() == 3 {
        let a = separators[0].trim();
        let b = separators[1].trim();
        let c = separators[2].trim();
        if a.len() == 4 {
            return format!("{:0>2}-{:0>2}-{}", b, c, a);
        }
        if c.len() == 4 {
            return format!("{:0>2}-{:0>2}-{}", a, b, c);
        }
    }
    value.to_string()
}

fn build_address(street: &str, city: &str, state: &str, zip: &str, fallback: &str) -> String {
    let street = street.trim();
    let city = city.trim();
    let state = state.trim();
    let zip = zip.trim();
    if street.is_empty() && city.is_empty() && state.is_empty() && zip.is_empty() {
        return fallback.trim().replace('|', ", ");
    }
    let second = [city, state, zip].iter().filter(|part| !part.is_empty()).map(|part| part.to_string()).collect::<Vec<String>>().join(", ");
    if second.is_empty() {
        street.to_string()
    } else if street.is_empty() {
        second
    } else {
        format!("{street}\n{second}")
    }
}

fn extract_client(body: &Value) -> IncomingClient {
    let street = pick_string(body, &[&["current_street"], &["street"], &["client", "current_street"], &["client", "street"]]);
    let city = pick_string(body, &[&["current_city"], &["city"], &["client", "current_city"], &["client", "city"]]);
    let state = pick_string(body, &[&["current_state"], &["state"], &["client", "current_state"], &["client", "state"]]);
    let zip = pick_string(body, &[&["current_zip"], &["zip"], &["postal_code"], &["client", "current_zip"], &["client", "zip"]]);
    let fallback_address = pick_string(body, &[&["address"], &["current_address"], &["client", "address"], &["client", "current_address"]]);
    let phone = normalize_phone_ten(&pick_string(body, &[&["cell_phone"], &["phone"], &["phone_number"], &["client", "cell_phone"], &["client", "phone"]]));
    let dob = normalize_dob_mmddyyyy(&pick_string(body, &[&["date_of_birth"], &["dob"], &["client", "date_of_birth"], &["client", "dob"]]));
    let ssn = normalize_ssn(&pick_string(body, &[&["ssn"], &["client", "ssn"]]));
    let monitoring_agency = pick_string(body, &[&["monitoring_agency_id"], &["monitoring_agency"], &["client", "monitoring_agency_id"], &["client", "monitoring_agency"]]);
    let notes = pick_string(body, &[&["sticky_note"], &["notes"], &["client", "sticky_note"], &["client", "notes"]]);
    IncomingClient {
        first_name: pick_string(body, &[&["first_name"], &["firstName"], &["client", "first_name"], &["client", "firstName"]]),
        last_name: pick_string(body, &[&["last_name"], &["lastName"], &["client", "last_name"], &["client", "lastName"]]),
        email: pick_string(body, &[&["email_id"], &["email"], &["client", "email_id"], &["client", "email"]]),
        phone,
        status: pick_string(body, &[&["status"], &["client", "status"]]),
        phase: pick_string(body, &[&["phase"], &["client", "phase"]]),
        street: street.clone(),
        city: city.clone(),
        state: state.clone(),
        zip: zip.clone(),
        address: build_address(&street, &city, &state, &zip, &fallback_address),
        dob,
        ssn,
        goal: pick_string(body, &[&["goal"], &["client", "goal"]]),
        notes,
        monitoring_agency,
        monitoring_username: pick_string(body, &[&["monitoring_username"], &["client", "monitoring_username"]]),
        monitoring_password: pick_string(body, &[&["monitoring_password"], &["client", "monitoring_password"]]),
        secret_key: pick_string(body, &[&["secret_key"], &["client", "secret_key"]]),
        portal_password: pick_string(body, &[&["portal_login"], &["portal_password"], &["client", "portal_login"], &["client", "portal_password"]]),
    }
}

async fn load_setting_json(state: &AppState, key: &str) -> AppResult<Value> {
    #[derive(Deserialize)]
    struct Row {
        value_json: String,
    }

    let mut resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut resp, 0)?;
    Ok(row.and_then(|value| serde_json::from_str::<Value>(&value.value_json).ok()).unwrap_or_else(|| json!({})))
}

async fn load_disputefox_integration(state: &AppState) -> AppResult<DisputefoxIntegration> {
    let raw = load_setting_json(state, "integration.disputefox").await?;
    Ok(serde_json::from_value(raw).unwrap_or_default())
}

async fn load_gohighlevel_integration(state: &AppState) -> AppResult<GhlIntegration> {
    let raw = load_setting_json(state, "integration.gohighlevel").await?;
    Ok(serde_json::from_value(raw).unwrap_or_default())
}

async fn sync_to_gohighlevel(state: &AppState, client: &IncomingClient) -> AppResult<Value> {
    let integration = load_gohighlevel_integration(state).await?;
    let api_token = integration.api_token.trim().to_string();
    let location_id = if integration.location_id.trim().is_empty() {
        "BTUVP8XCPh6i633PAvD4".to_string()
    } else {
        integration.location_id.trim().to_string()
    };
    if api_token.is_empty() {
        return Ok(json!({ "attempted": false, "reason": "missing-api-token" }));
    }

    let payload = json!({
        "firstName": client.first_name,
        "lastName": client.last_name,
        "email": client.email,
        "phone": client.phone,
        "locationId": location_id,
        "source": "DisputeFox",
        "tags": ["DisputeFox", "Ninja Tools"],
        "address1": client.street,
        "city": client.city,
        "state": client.state,
        "postalCode": client.zip,
        "dateOfBirth": client.dob,
        "ssn": client.ssn,
    });

    let response = crate::http::shared()
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
    Ok(json!({
        "attempted": true,
        "ok": status.is_success(),
        "status": status.as_u16(),
        "parsed": parsed,
        "contactId": parsed.get("contact").and_then(|value| value.get("id")).and_then(|value| value.as_str()).unwrap_or(""),
        "locationId": location_id,
    }))
}

async fn sync_to_google_contacts(integration: &DisputefoxIntegration, client: &IncomingClient) -> AppResult<Value> {
    if integration.google_contacts_enabled == Some(false) {
        return Ok(json!({ "attempted": false, "reason": "disabled" }));
    }
    let access_token = integration.google_access_token.trim().to_string();
    if access_token.is_empty() {
        return Ok(json!({ "attempted": false, "reason": "missing-google-access-token" }));
    }

    let mut user_defined: Vec<Value> = Vec::new();
    if !client.monitoring_username.trim().is_empty() {
        user_defined.push(json!({ "key": "Credit Monitoring", "value": client.monitoring_username }));
    }
    if !client.monitoring_password.trim().is_empty() {
        user_defined.push(json!({ "key": "PW", "value": client.monitoring_password }));
    }

    let payload = json!({
        "names": [{
            "givenName": client.first_name,
            "familyName": client.last_name,
        }],
        "emailAddresses": if client.email.trim().is_empty() { json!([]) } else { json!([{ "value": client.email, "type": "work" }]) },
        "phoneNumbers": if client.phone.trim().is_empty() { json!([]) } else { json!([{ "value": client.phone, "type": "mobile" }]) },
        "addresses": if client.street.trim().is_empty() && client.city.trim().is_empty() && client.state.trim().is_empty() && client.zip.trim().is_empty() {
            json!([])
        } else {
            json!([{
                "streetAddress": client.street,
                "city": client.city,
                "region": client.state,
                "postalCode": client.zip,
                "type": "home"
            }])
        },
        "biographies": [{
            "value": format!("DOB : {}\nSSN : {}\nMonitoring = {}", client.dob, client.ssn, client.monitoring_agency),
            "contentType": "TEXT_PLAIN"
        }],
        "userDefined": user_defined,
    });

    let response = crate::http::shared()
        .post("https://people.googleapis.com/v1/people:createContact")
        .bearer_auth(access_token)
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let status = response.status();
    let parsed: Value = response.json().await.unwrap_or_else(|_| json!({}));
    Ok(json!({
        "attempted": true,
        "ok": status.is_success(),
        "status": status.as_u16(),
        "parsed": parsed,
        "resourceName": parsed.get("resourceName").and_then(|value| value.as_str()).unwrap_or(""),
    }))
}

async fn upsert_surreal_client(state: &AppState, client: &IncomingClient, ghl_result: &Value) -> AppResult<Value> {
    let email_n = client.email.trim().to_lowercase();
    let phone_n: String = client.phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let first_name_n = client.first_name.trim().to_lowercase();
    let last_name_n = client.last_name.trim().to_lowercase();
    let mut existing: Option<Value> = None;

    if !email_n.is_empty() {
        let mut resp = state.db
            .query("SELECT * FROM client WHERE email_n = $email LIMIT 1")
            .bind(("email", email_n.clone()))
            .await?;
        existing = crate::db::take_one(&mut resp, 0)?;
    }
    if existing.is_none() && !phone_n.is_empty() {
        let mut resp = state.db
            .query("SELECT * FROM client WHERE phone_n = $phone LIMIT 1")
            .bind(("phone", phone_n.clone()))
            .await?;
        existing = crate::db::take_one(&mut resp, 0)?;
    }
    if existing.is_none() && !first_name_n.is_empty() && !last_name_n.is_empty() {
        let mut resp = state.db
            .query("SELECT * FROM client WHERE string::lowercase(first_name) = $fn AND string::lowercase(last_name) = $ln LIMIT 1")
            .bind(("fn", first_name_n))
            .bind(("ln", last_name_n))
            .await?;
        existing = crate::db::take_one(&mut resp, 0)?;
    }

    let external_client_id = ghl_result.get("contactId").and_then(|value| value.as_str()).unwrap_or("").to_string();
    let status_value = if client.status.trim().is_empty() { "Client" } else { client.status.trim() }.to_string();
    let phase_value = if client.phase.trim().is_empty() { "None" } else { client.phase.trim() }.to_string();
    let extra = json!({
        "monitoringAgency": client.monitoring_agency,
        "monitoringUsername": client.monitoring_username,
        "monitoringPassword": client.monitoring_password,
        "secretKey": client.secret_key,
        "portalPassword": client.portal_password,
        "source": "disputefox",
    });

    if let Some(found) = existing {
        let rid = found.get("id").cloned().unwrap_or(Value::Null);
        let mut resp = state.db
            .query("UPDATE $rid SET first_name = $fn, last_name = $ln, email = $email, phone = $phone, email_n = $em, phone_n = $ph, status = $status, phase = $phase, address = $address, dob = $dob, ssn = $ssn, goal = $goal, notes = $notes, extra = $extra, external_client_id = $external, updated_at = time::now() RETURN AFTER")
            .bind(("rid", rid))
            .bind(("fn", client.first_name.clone()))
            .bind(("ln", client.last_name.clone()))
            .bind(("email", client.email.clone()))
            .bind(("phone", client.phone.clone()))
            .bind(("em", email_n))
            .bind(("ph", phone_n))
            .bind(("status", status_value))
            .bind(("phase", phase_value))
            .bind(("address", client.address.clone()))
            .bind(("dob", client.dob.clone()))
            .bind(("ssn", client.ssn.clone()))
            .bind(("goal", client.goal.clone()))
            .bind(("notes", client.notes.clone()))
            .bind(("extra", extra))
            .bind(("external", external_client_id))
            .await?;
        let updated: Option<Value> = crate::db::take_one(&mut resp, 0)?;
        return Ok(json!({ "attempted": true, "ok": true, "action": "updated", "client": updated }));
    }

    let mut resp = state.db
        .query("CREATE client SET first_name = $fn, last_name = $ln, email = $email, phone = $phone, email_n = $em, phone_n = $ph, status = $status, phase = $phase, address = $address, dob = $dob, ssn = $ssn, goal = $goal, notes = $notes, extra = $extra, external_client_id = $external, created_at = time::now(), updated_at = time::now() RETURN AFTER")
        .bind(("fn", client.first_name.clone()))
        .bind(("ln", client.last_name.clone()))
        .bind(("email", client.email.clone()))
        .bind(("phone", client.phone.clone()))
        .bind(("em", email_n))
        .bind(("ph", phone_n))
        .bind(("status", status_value))
        .bind(("phase", phase_value))
        .bind(("address", client.address.clone()))
        .bind(("dob", client.dob.clone()))
        .bind(("ssn", client.ssn.clone()))
        .bind(("goal", client.goal.clone()))
        .bind(("notes", client.notes.clone()))
        .bind(("extra", extra))
        .bind(("external", external_client_id))
        .await?;
    let created: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    Ok(json!({ "attempted": true, "ok": true, "action": "created", "client": created }))
}

async fn sync_to_airtable(integration: &DisputefoxIntegration, client: &IncomingClient) -> AppResult<Value> {
    let token = integration.airtable_token.trim().to_string();
    let base_id = if integration.airtable_base_id.trim().is_empty() {
        "appmye1ShMwAPPGNM".to_string()
    } else {
        integration.airtable_base_id.trim().to_string()
    };
    let table_id = if integration.airtable_table_id.trim().is_empty() {
        "tbl7O2USkxjDlK2tw".to_string()
    } else {
        integration.airtable_table_id.trim().to_string()
    };
    if token.is_empty() {
        return Ok(json!({ "attempted": false, "reason": "missing-airtable-token" }));
    }

    let fields = json!({
        "fldGE3lTA5UWuJkLA": client.phone,
        "fldwRqQQelrcxccK5": client.first_name,
        "fld7zwXpZt9BGVoV0": client.last_name,
        "fld8tdNpZqSoP4ros": client.email,
        "fld1EU5QaUaSf1Blt": format!("{}{}{}{}", client.street, client.city, client.state, client.zip),
        "fldezxXwAV7kTwCM3": client.dob,
        "fld0Mbky3WFpKq9Jh": client.ssn,
        "fldTRPFLlz0vD3yxB": client.monitoring_password,
        "fld2Bzo10FfVC7ZRt": client.monitoring_agency,
        "fldTyIdM2UC1xqIVF": client.notes,
        "fldDxHWjC1H9Gzkj6": client.portal_password,
        "fldaAgMFmamXugCJw": client.secret_key,
    });

    let response = crate::http::shared()
        .post(format!("https://api.airtable.com/v0/{}/{}", base_id, table_id))
        .bearer_auth(token)
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .json(&json!({ "records": [{ "fields": fields }] }))
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let status = response.status();
    let parsed: Value = response.json().await.unwrap_or_else(|_| json!({}));
    Ok(json!({
        "attempted": true,
        "ok": status.is_success(),
        "status": status.as_u16(),
        "parsed": parsed,
        "recordId": parsed.get("records").and_then(|value| value.get(0)).and_then(|value| value.get("id")).and_then(|value| value.as_str()).unwrap_or(""),
    }))
}

pub async fn webhook(
    State(state): State<AppState>,
    Query(q): Query<KeyQuery>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let integration = load_disputefox_integration(&state).await?;
    let required_key = if integration.webhook_key.trim().is_empty() {
        std::env::var("DISPUTEFOX_WEBHOOK_KEY").unwrap_or_default()
    } else {
        integration.webhook_key.trim().to_string()
    };
    let provided = q.key
        .clone()
        .or_else(|| headers.get("x-disputefox-key").and_then(|v| v.to_str().ok().map(|s| s.to_string())))
        .or_else(|| headers.get("x-webhook-key").and_then(|v| v.to_str().ok().map(|s| s.to_string())))
        .or_else(|| {
            headers.get(axum::http::header::AUTHORIZATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.strip_prefix("Bearer "))
                .map(|s| s.to_string())
        })
        .unwrap_or_default();

    if !required_key.is_empty() && provided.trim() != required_key {
        return Err(AppError::Unauthorized);
    }

    let client = extract_client(&body);
    if client.first_name.trim().is_empty() || client.last_name.trim().is_empty() {
        return Err(AppError::BadRequest("DisputeFox payload must include first and last name.".into()));
    }

    let ghl = sync_to_gohighlevel(&state, &client).await?;
    let google = sync_to_google_contacts(&integration, &client).await?;
    let surreal = upsert_surreal_client(&state, &client, &ghl).await?;
    let airtable = sync_to_airtable(&integration, &client).await?;

    Ok((StatusCode::OK, Json(json!({
        "ok": true,
        "source": "disputefox",
        "client": {
            "firstName": client.first_name,
            "lastName": client.last_name,
            "email": client.email,
            "phone": client.phone,
            "address": client.address,
            "dob": client.dob,
            "ssn": client.ssn,
        },
        "steps": {
            "gohighlevel": ghl,
            "googleContacts": google,
            "surrealdb": surreal,
            "airtable": airtable
        }
    }))))
}
