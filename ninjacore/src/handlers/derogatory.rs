//! Derogatory account extraction for the training view.
//!
//!   GET /api/training/clients/:id/derogatory
//!
//! Two data paths (matches server.mjs orchestration order):
//!
//!   1. **Remote NinjaDispute pull** — login (ro), search by email/name/phone,
//!      pick best match, fetch `/clients/:id?all=true`, extract derogatory
//!      tradelines from the per-bureau row shape `{transunion, experian, equifax}`.
//!      This is the primary path.
//!
//!   2. **Local fallback** — `client.credit_report_json` parsed in-place.
//!      Two sub-shapes recognized:
//!        a) Already in NinjaDispute row shape (re-uses the same parser).
//!        b) SmartCredit XML→JSON `TrueLinkCreditReportType` shape — currently
//!           returns empty + a warning. The full parser (`getSmartCreditReportRoot`,
//!           `buildSubscriberContactMaps`, `parseDerogatoryAccountsFromPartitions`,
//!           `enrichDerogatoryAccountsWithSubscriberContacts`) is ~500 lines of
//!           SmartCredit-specific XML traversal that needs its own focused pass.

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Serialize)]
pub struct DerogatoryResponse {
    pub ok: bool,
    pub client: ClientView,
    pub accounts: Vec<Value>,
    pub source: String,
    #[serde(rename = "matchedRemoteClient")]
    pub matched_remote_client: Option<Value>,
    pub warnings: Vec<String>,
}

#[derive(Serialize)]
pub struct ClientView {
    pub id: String,
    #[serde(rename = "firstName")] pub first_name: String,
    #[serde(rename = "lastName")] pub last_name: String,
    pub email: String,
    #[serde(rename = "reportDate")] pub report_date: String,
}

pub async fn get_derogatory(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(client_id): Path<String>,
) -> AppResult<Json<DerogatoryResponse>> {
    #[derive(Deserialize, Default)]
    struct ClientRow {
        id: Option<String>,
        #[serde(default)] first_name: String,
        #[serde(default)] last_name: String,
        #[serde(default)] email: String,
        #[serde(default)] phone: String,
        #[serde(default)] report_date: String,
        #[serde(default)] credit_report_json: String,
    }

    let mut __resp = state.db
        .query("SELECT * FROM ONLY type::thing('clients', $id) LIMIT 1")
        .bind(("id", client_id.clone()))
        .await?;
    let client: Option<ClientRow> = crate::db::take_one(&mut __resp, 0)?;
    let client = client.ok_or(AppError::NotFound)?;
    let view = ClientView {
        id: client.id.clone().unwrap_or(client_id),
        first_name: client.first_name.clone(),
        last_name: client.last_name.clone(),
        email: client.email.clone(),
        report_date: client.report_date.clone(),
    };

    let integration = load_ninjadispute_integration(&state).await?;
    let mut warnings: Vec<String> = Vec::new();
    let mut source = "local-json".to_string();
    let mut matched: Option<Value> = None;
    let mut accounts: Vec<Value>;

    // Try remote first.
    let remote = if integration.is_configured() {
        match pull_from_ninjadispute(&integration, &client.first_name, &client.last_name, &client.email, &client.phone).await {
            Ok(r) => Some(r),
            Err(e) => {
                warnings.push(format!("Remote NinjaDispute pull failed: {e}"));
                None
            }
        }
    } else {
        warnings.push("integration.ninjadispute not configured; skipped remote pull.".into());
        None
    };

    if let Some(r) = remote {
        accounts = r.accounts;
        source = format!("remote-{}", r.source);
        matched = r.matched_client;
    } else {
        accounts = Vec::new();
    }

    // Local fallback / merge.
    let local_value = parse_json_loose(&client.credit_report_json);
    if let Some(v) = local_value.as_ref() {
        let local_all = parse_derogatory_rows(v, true);
        let local_derog = parse_derogatory_rows(v, false);
        if !accounts.is_empty() && !local_all.is_empty() {
            accounts = merge_derogatory(accounts, local_all);
        } else if accounts.is_empty() && !local_derog.is_empty() {
            accounts = local_derog;
            source = "local-json-fallback-after-remote-empty".into();
            warnings.push("Remote source returned zero derogatory rows; used local JSON fallback.".into());
        } else if accounts.is_empty() && !is_dispute_row_shape(v) && !v.get("creditReport").is_none() {
            warnings.push("Local credit report appears to be SmartCredit-shaped; parser pending. \
                Remote NinjaDispute remains the recommended source.".into());
        }
    } else if accounts.is_empty() {
        source = "none".into();
    }

    Ok(Json(DerogatoryResponse {
        ok: true,
        client: view,
        accounts,
        source,
        matched_remote_client: matched,
        warnings,
    }))
}

// ─── NinjaDispute integration ─────────────────────────────────────────────

#[derive(Debug, Default, Clone, Deserialize)]
struct NinjaDisputeIntegration {
    #[serde(default, rename = "baseUrl")] base_url: String,
    #[serde(default)] username: String,
    #[serde(default)] password: String,
    #[serde(default, rename = "apiToken")] api_token: String,
}

impl NinjaDisputeIntegration {
    fn is_configured(&self) -> bool {
        !self.base_url.trim().is_empty()
            && (!self.api_token.trim().is_empty()
                || (!self.username.trim().is_empty() && !self.password.trim().is_empty()))
    }
}

async fn load_ninjadispute_integration(state: &AppState) -> AppResult<NinjaDisputeIntegration> {
    #[derive(Deserialize)] struct Row { value_json: String }
    let mut __resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = 'integration.ninjadispute' LIMIT 1")
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut __resp, 0)?;
    Ok(row
        .and_then(|r| serde_json::from_str::<NinjaDisputeIntegration>(&r.value_json).ok())
        .unwrap_or_default())
}

struct RemoteResult {
    accounts: Vec<Value>,
    source: String,
    matched_client: Option<Value>,
}

async fn pull_from_ninjadispute(
    integ: &NinjaDisputeIntegration,
    first: &str, last: &str, email: &str, phone: &str,
) -> anyhow::Result<RemoteResult> {
    let base = integ.base_url.trim_end_matches('/').to_string();
    let token = resolve_bearer(integ).await?;
    let client = crate::http::shared();

    // Compose distinct search terms.
    let mut terms: Vec<String> = Vec::new();
    if !email.trim().is_empty() { terms.push(email.trim().to_string()); }
    let name = format!("{first} {last}").trim().to_string();
    if !name.is_empty() { terms.push(name.clone()); }
    let phone_digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if !phone_digits.is_empty() { terms.push(phone_digits.clone()); }

    // Issue every term search concurrently — they hit the same upstream but
    // are independent reads, so Tokio can overlap their RTTs.
    let search_futs = terms.iter().map(|t| {
        let client = client.clone();
        let token = token.clone();
        let base = base.to_string();
        let term = t.clone();
        async move {
            let resp = client
                .get(format!("{base}/clients"))
                .bearer_auth(&token)
                .query(&[("search", term.as_str())])
                .send()
                .await
                .ok()?;
            if !resp.status().is_success() { return None; }
            resp.json::<Value>().await.ok()
        }
    });
    let term_responses = futures_util::future::join_all(search_futs).await;

    let mut seen: HashSet<String> = HashSet::new();
    let mut candidates: Vec<Value> = Vec::new();
    for v in term_responses.into_iter().flatten() {
        let empty: Vec<Value> = Vec::new();
        let rows = v.get("clients").and_then(|x| x.as_array())
            .or_else(|| v.get("data").and_then(|x| x.as_array()))
            .or_else(|| v.as_array())
            .unwrap_or(&empty);
        for row in rows {
            let id = row["id"].as_str().or(row["client_id"].as_str()).unwrap_or("").trim().to_string();
            if id.is_empty() || !seen.insert(id.clone()) { continue; }
            candidates.push(row.clone());
        }
    }

    let matched = pick_best_match(&candidates, first, last, email, &phone_digits)
        .ok_or_else(|| anyhow::anyhow!("No matching NinjaDispute client was found for this contact."))?;

    let id = matched["id"].as_str().or(matched["client_id"].as_str()).unwrap_or("").trim().to_string();
    let resp = client
        .get(format!("{base}/clients/{id}?all=true"))
        .bearer_auth(&token)
        .send().await?;
    if !resp.status().is_success() {
        return Err(anyhow::anyhow!("NinjaDispute fetch /clients/{id} returned {}", resp.status()));
    }
    let payload: Value = resp.json().await.unwrap_or(json!({}));
    let accounts = extract_derogatory_from_remote_client(&payload);
    Ok(RemoteResult {
        accounts,
        source: "ninjadispute".into(),
        matched_client: Some(matched.clone()),
    })
}

async fn resolve_bearer(integ: &NinjaDisputeIntegration) -> anyhow::Result<String> {
    if !integ.api_token.trim().is_empty() {
        return Ok(integ.api_token.trim().to_string());
    }
    let client = crate::http::shared();
    let base = integ.base_url.trim_end_matches('/');
    let resp = client
        .post(format!("{base}/auth/login"))
        .json(&json!({ "username": integ.username, "password": integ.password }))
        .send().await?;
    if !resp.status().is_success() {
        return Err(anyhow::anyhow!("NinjaDispute login returned {}", resp.status()));
    }
    let v: Value = resp.json().await.unwrap_or(json!({}));
    let token = v["token"].as_str()
        .or(v["access_token"].as_str())
        .or(v["jwt"].as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow::anyhow!("NinjaDispute login returned no token"))?;
    Ok(token)
}

fn pick_best_match<'a>(
    cands: &'a [Value], first: &str, last: &str, email: &str, phone_digits: &str,
) -> Option<&'a Value> {
    let e = email.trim().to_lowercase();
    let p = phone_digits;
    let f = first.trim().to_lowercase();
    let l = last.trim().to_lowercase();
    // 1. exact email
    if !e.is_empty() {
        if let Some(c) = cands.iter().find(|c| c["email"].as_str().unwrap_or("").trim().to_lowercase() == e) {
            return Some(c);
        }
    }
    // 2. exact phone digits
    if !p.is_empty() {
        if let Some(c) = cands.iter().find(|c| {
            let cp: String = c["phone"].as_str().unwrap_or("").chars().filter(|x| x.is_ascii_digit()).collect();
            cp == p
        }) {
            return Some(c);
        }
    }
    // 3. first + last
    if !f.is_empty() && !l.is_empty() {
        if let Some(c) = cands.iter().find(|c| {
            let cf = c["first_name"].as_str().or(c["firstName"].as_str()).unwrap_or("").trim().to_lowercase();
            let cl = c["last_name"].as_str().or(c["lastName"].as_str()).unwrap_or("").trim().to_lowercase();
            cf == f && cl == l
        }) {
            return Some(c);
        }
    }
    cands.first()
}

fn extract_derogatory_from_remote_client(payload: &Value) -> Vec<Value> {
    // Try `rows` (NinjaDispute's per-bureau shape) under several common keys.
    for key in ["accounts", "tradelines", "rows", "report", "creditReport"] {
        if let Some(arr) = payload.get(key).and_then(|v| v.as_array()) {
            let parsed = parse_derogatory_rows(&Value::Array(arr.clone()), false);
            if !parsed.is_empty() { return parsed; }
        }
    }
    // Fall through: treat the whole payload as the rows array.
    parse_derogatory_rows(payload, false)
}

// ─── Parser for NinjaDispute row shape ────────────────────────────────────

fn is_dispute_row_shape(v: &Value) -> bool {
    let probe = |row: &Value| {
        row.get("transunion").is_some()
            || row.get("experian").is_some()
            || row.get("equifax").is_some()
    };
    match v {
        Value::Array(arr) => arr.iter().any(probe),
        Value::Object(_) => probe(v),
        _ => false,
    }
}

fn parse_derogatory_rows(value: &Value, include_non_derogatory: bool) -> Vec<Value> {
    let empty: Vec<Value> = Vec::new();
    let rows: &[Value] = match value {
        Value::Array(arr) => arr,
        Value::Object(_) => std::slice::from_ref(value),
        _ => &empty,
    };

    let mut accounts: Vec<Value> = Vec::new();
    let mut row_id = 1u64;

    for row in rows {
        let tu = to_bureau_view(row.get("transunion"), include_non_derogatory);
        let ex = to_bureau_view(row.get("experian"), include_non_derogatory);
        let eq = to_bureau_view(row.get("equifax"), include_non_derogatory);
        if tu.is_none() && ex.is_none() && eq.is_none() { continue; }
        let creditor = row.get("acc_name").or(row.get("name")).and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let acct_num = row.get("acc_num").or(row.get("accountNumber")).and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let acct_type = row.get("type").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        accounts.push(json!({
            "id": format!("derog-{row_id}"),
            "creditorName": creditor,
            "accountNumber": acct_num,
            "accountType": acct_type,
            "bureaus": { "transunion": tu, "experian": ex, "equifax": eq },
            "raw": row,
        }));
        row_id += 1;
    }
    accounts
}

fn to_bureau_view(entry: Option<&Value>, include_non_derogatory: bool) -> Option<Value> {
    let e = entry?;
    if !e.is_object() { return None; }
    let pick = |keys: &[&[&str]]| -> String {
        for path in keys {
            let mut cur = e;
            let mut ok = true;
            for k in *path {
                if let Some(n) = cur.get(*k) { cur = n; } else { ok = false; break; }
            }
            if ok {
                if let Some(s) = cur.as_str() {
                    let t = s.trim();
                    if !t.is_empty() { return t.to_string(); }
                }
            }
        }
        String::new()
    };
    let status         = pick(&[&["status"], &["AccountCondition","description"], &["AccountCondition","@description"], &["classifycations","dataButton","paymentStatus"]]);
    let payment_status = pick(&[&["paymentStatus"], &["PayStatus","description"], &["PayStatus","@description"], &["classifycations","dataButton","paymentStatus"]]);
    let account_type   = pick(&[&["accountType"], &["classifycations","dataButton","accountType"]]);
    let account_type_d = pick(&[&["accountTypeDetail"], &["classifycations","dataButton","accountTypeDetail"]]);
    let account_rating = pick(&[&["accountRating"], &["AccountCondition","description"], &["AccountCondition","@description"]]);

    let is_derog = is_derogatory_candidate(&status, &payment_status, &account_type, &account_type_d, &account_rating);
    if !include_non_derogatory && !is_derog { return None; }

    let s_field = |k: &str| e.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
    Some(json!({
        "status": status,
        "paymentStatus": payment_status,
        "accountType": account_type,
        "accountTypeDetail": account_type_d,
        "accountRating": account_rating,
        "balance": s_field("balance"),
        "creditLimit": s_field("creditLimit"),
        "highBalance": s_field("highBalance"),
        "dateOpened": s_field("dateOpened"),
        "dateLastActive": s_field("dateLastActive"),
        "dateOfLastPayment": s_field("dateOfLastPayment"),
        "monthlyPayment": s_field("monthlyPayment"),
        "raw": e,
    }))
}

fn is_derogatory_candidate(
    status: &str, pay_status: &str, account_type: &str, _atd: &str, rating: &str,
) -> bool {
    let bag = format!(
        "{} {} {} {}",
        status.to_lowercase(),
        pay_status.to_lowercase(),
        account_type.to_lowercase(),
        rating.to_lowercase(),
    );
    [
        "charge", "charged off", "collection", "late", "past due", "delinquent",
        "repossess", "foreclos", "settled", "default", "derogatory", "30 days",
        "60 days", "90 days", "120 days", "judgment", "bankruptcy",
    ].iter().any(|kw| bag.contains(kw))
}

fn merge_derogatory(primary: Vec<Value>, fallback: Vec<Value>) -> Vec<Value> {
    if primary.is_empty() { return fallback; }
    if fallback.is_empty() { return primary; }
    let key = |v: &Value| -> String {
        v["accountNumber"].as_str().unwrap_or("").chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .map(|c| c.to_ascii_lowercase())
            .collect()
    };
    let mut by_key: std::collections::HashMap<String, Value> = primary.iter()
        .map(|p| (key(p), p.clone())).collect();
    for fb in fallback {
        let k = key(&fb);
        if k.is_empty() { continue; }
        by_key.entry(k).or_insert(fb);
    }
    by_key.into_values().collect()
}

fn parse_json_loose(text: &str) -> Option<Value> {
    let t = text.trim();
    if t.is_empty() { return None; }
    serde_json::from_str(t).ok()
}
