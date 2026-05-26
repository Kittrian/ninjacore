//! Billing — failed payments pipeline.
//!
//!   GET  /api/billing/failed-payments?q=&limit=
//!   POST /api/billing/safe-query-all-failed-trans
//!
//! Pipeline:
//!   1. List active merchants for the owner whose gateway is in
//!      {square, nmi, bankcard}.
//!   2. For each merchant, pull failed transactions over `daysBack` days
//!      (Square: REST `/v2/payments` filtered to FAILED, paginated by `cursor`;
//!      NMI / Bankcard: POST `https://secure.nmi.com/api/query.php` and parse
//!      `<transaction>` blocks).
//!   3. Dedupe by `transactionId` and (unless `dryRun`) upsert each into
//!      `payment_events` keyed by `<owner>_<transactionId>`.
//!   4. POST each not-yet-synced event to the billing integration's
//!      `failedPaymentsWebhookUrl`; mark `webhook_synced_at` on success.

use axum::extract::{Query, State};
use axum::Json;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const OWNER: &str = "admin";

// ─── GET /api/billing/failed-payments ────────────────────────────────────

#[derive(Deserialize)]
pub struct FailedQuery {
    #[serde(default)] pub q: Option<String>,
    #[serde(default)] pub limit: Option<i64>,
}

pub async fn failed_payments(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(q): Query<FailedQuery>,
) -> AppResult<Json<Value>> {
    let limit = q.limit.unwrap_or(500).clamp(1, 2000);
    let needle = q.q.unwrap_or_default().trim().to_lowercase();
    let events = list_failed_events(&state, limit, &needle).await?;
    Ok(Json(json!({ "ok": true, "events": events, "count": events.len() })))
}

// ─── POST /api/billing/safe-query-all-failed-trans ───────────────────────

#[derive(Deserialize, Default)]
pub struct SafeQueryBody {
    #[serde(default, rename = "dryRun")] pub dry_run: bool,
    #[serde(default)] pub limit: Option<i64>,
    #[serde(default, rename = "daysBack")] pub days_back: Option<i64>,
}

pub async fn safe_query(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<SafeQueryBody>,
) -> AppResult<Json<Value>> {
    let max_rows = body.limit.unwrap_or(2000).clamp(1, 5000);
    let lookback = body.days_back.unwrap_or(7).clamp(1, 30);

    let billing = load_billing_integration(&state).await?;
    let pull = run_failed_payment_pull(&state, body.dry_run, max_rows, lookback).await?;

    let mut webhook_results: Vec<WebhookOutcome> = Vec::new();
    if !body.dry_run {
        let webhook_url = billing.failed_payments_webhook_url.trim();
        if webhook_url.is_empty() {
            return Err(AppError::BadRequest("Billing webhook URL is not configured.".into()));
        }

        let owner_events = list_failed_events(&state, max_rows, "").await?;
        for event in owner_events {
            if !event.webhook_synced_at.is_empty() {
                continue;
            }
            let outcome = match send_failed_payment_webhook(&event, &billing).await {
                Ok(o) => o,
                Err(e) => WebhookOutcome {
                    transaction_id: event.transaction_id.clone(),
                    name: event.client_name.clone(),
                    ok: false,
                    status: 0,
                    response_body: None,
                    error: Some(e.to_string()),
                },
            };

            // Mark webhook_synced_at on success.
            let rec_id = payment_event_record_id(OWNER, &event.transaction_id);
            let synced_at = if outcome.ok {
                Some(now_rfc3339())
            } else { None };
            let _ = state.db
                .query("UPDATE type::thing('payment_events', $rid) SET \
                        webhook_synced_at = $sa, webhook_last_status = $st, updated_at = time::now()")
                .bind(("rid", rec_id))
                .bind(("sa", synced_at))
                .bind(("st", outcome.status as i64))
                .await;

            webhook_results.push(outcome);
        }
    }

    let success_count = webhook_results.iter().filter(|r| r.ok).count();
    let failed_count = webhook_results.len() - success_count;

    let results_value: Value = if body.dry_run {
        json!(pull.events)
    } else {
        json!(webhook_results)
    };

    Ok(Json(json!({
        "ok": true,
        "dryRun": body.dry_run,
        "ownerKey": OWNER,
        "daysBack": lookback,
        "merchantsScanned": pull.merchants_scanned,
        "merchantResults": pull.merchant_results,
        "pulledCount": pull.pulled_count,
        "dedupedCount": pull.deduped_count,
        "totalMatched": if body.dry_run { pull.deduped_count } else { pull.upserted_count },
        "attempted": if body.dry_run { 0 } else { webhook_results.len() },
        "successCount": if body.dry_run { 0 } else { success_count },
        "failedCount": if body.dry_run { 0 } else { failed_count },
        "results": results_value,
    })))
}

// ─── Types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BillingIntegration {
    #[serde(default, rename = "failedPaymentsWebhookUrl")]
    pub failed_payments_webhook_url: String,
    #[serde(default, rename = "webhookHeaderName")]
    pub webhook_header_name: String,
    #[serde(default, rename = "webhookHeaderValue")]
    pub webhook_header_value: String,
    #[serde(default, rename = "scriptTriggerSecret")]
    pub script_trigger_secret: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FailedEventOut {
    pub id: String,
    #[serde(rename = "transactionId")] pub transaction_id: String,
    #[serde(rename = "eventAt")] pub event_at: String,
    #[serde(rename = "clientName")] pub client_name: String,
    pub email: String,
    pub phone: String,
    #[serde(rename = "amountCents")] pub amount_cents: i64,
    pub amount: String,
    #[serde(rename = "cardLast4")] pub card_last4: String,
    #[serde(rename = "paymentMethod")] pub payment_method: String,
    #[serde(rename = "failureReason")] pub failure_reason: String,
    #[serde(rename = "retryLabel")] pub retry_label: String,
    pub notes: String,
    pub status: String,
    #[serde(rename = "nextAction")] pub next_action: String,
    pub completed: String,
    pub processor: String,
    #[serde(rename = "customerId")] pub customer_id: String,
    #[serde(rename = "retryEligible")] pub retry_eligible: bool,
    #[serde(rename = "occurrenceCount")] pub occurrence_count: i64,
    #[serde(rename = "webhookSyncedAt")] pub webhook_synced_at: String,
    #[serde(rename = "webhookLastStatus")] pub webhook_last_status: Option<i64>,
    #[serde(rename = "createdAt")] pub created_at: String,
    #[serde(rename = "updatedAt")] pub updated_at: String,
    #[serde(rename = "lastSeenAt")] pub last_seen_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookOutcome {
    #[serde(rename = "transactionId")] transaction_id: String,
    name: String,
    pub ok: bool,
    pub status: u16,
    #[serde(rename = "responseBody", skip_serializing_if = "Option::is_none")]
    pub response_body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct NormalizedEvent {
    transaction_id: String,
    event_at: String,
    client_name: String,
    email: String,
    phone: String,
    amount_cents: i64,
    card_last4: String,
    payment_method: String,
    failure_reason: String,
    retry_label: String,
    notes: String,
    status: String,
    next_action: String,
    completed: String,
    processor: String,
    customer_id: String,
    retry_eligible: bool,
}

#[derive(Default, Debug, Serialize)]
pub struct PullResult {
    #[serde(rename = "merchantsScanned")] pub merchants_scanned: i64,
    #[serde(rename = "merchantResults")] pub merchant_results: Vec<Value>,
    #[serde(rename = "pulledCount")] pub pulled_count: i64,
    #[serde(rename = "dedupedCount")] pub deduped_count: i64,
    #[serde(rename = "upsertedCount")] pub upserted_count: i64,
    pub events: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct MerchantRow {
    #[serde(default)] id: i64,
    #[serde(default, rename = "merchantName")] merchant_name: String,
    #[serde(default)] gateway: String,
    #[serde(default)] status: String,
    #[serde(default, rename = "transactionKey")] transaction_key: Option<String>,
    #[serde(default, rename = "allowedRetries")] allowed_retries: Option<i64>,
    #[serde(default, rename = "retryFrequencyDays")] retry_frequency_days: Option<i64>,
}

// ─── DB queries ───────────────────────────────────────────────────────────

async fn load_billing_integration(state: &AppState) -> AppResult<BillingIntegration> {
    #[derive(Deserialize)] struct Row { value_json: String }
    let mut __resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = 'integration.billing' LIMIT 1")
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut __resp, 0)?;
    Ok(row
        .and_then(|r| serde_json::from_str::<BillingIntegration>(&r.value_json).ok())
        .unwrap_or_default())
}

async fn list_active_failed_merchants(state: &AppState) -> AppResult<Vec<MerchantRow>> {
    let mut __resp = state.db
        .query("SELECT * FROM payment_merchant WHERE owner_key = $o")
        .bind(("o", OWNER))
        .await?;
    let all: Vec<MerchantRow> = crate::db::take_many(&mut __resp, 0)?;
    Ok(all
        .into_iter()
        .filter(|m| m.status == "Active")
        .filter(|m| {
            matches!(normalize_failed_gateway(&m.gateway).as_str(), "square" | "nmi" | "bankcard")
        })
        .collect())
}

async fn list_failed_events(state: &AppState, limit: i64, needle: &str) -> AppResult<Vec<FailedEventOut>> {
    let mut __resp = state.db.query(
        "SELECT * FROM payment_events WHERE owner_key = $o ORDER BY event_at DESC LIMIT $lim")
        .bind(("o", OWNER))
        .bind(("lim", limit))
        .await?;
    let rows: Vec<Value> = crate::db::take_many(&mut __resp, 0)?;
    let mut out: Vec<FailedEventOut> = rows.into_iter().map(format_row).collect();
    if !needle.is_empty() {
        out.retain(|r| {
            r.transaction_id.to_lowercase().contains(needle)
                || r.client_name.to_lowercase().contains(needle)
                || r.email.to_lowercase().contains(needle)
                || r.phone.to_lowercase().contains(needle)
                || r.failure_reason.to_lowercase().contains(needle)
                || r.status.to_lowercase().contains(needle)
                || r.processor.to_lowercase().contains(needle)
                || r.notes.to_lowercase().contains(needle)
        });
    }
    Ok(out)
}

fn format_row(r: Value) -> FailedEventOut {
    let s = |k: &str| r.get(k).and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let n = |k: &str| r.get(k).and_then(|v| v.as_i64()).unwrap_or(0);
    let amount_cents = n("amount_cents");
    FailedEventOut {
        id: r.get("id").map(|v| v.to_string()).unwrap_or_default(),
        transaction_id: s("transaction_id"),
        event_at: s("event_at"),
        client_name: s("client_name"),
        email: s("email"),
        phone: s("phone"),
        amount_cents,
        amount: format!("{:.2}", amount_cents as f64 / 100.0),
        card_last4: s("card_last4"),
        payment_method: s("payment_method"),
        failure_reason: s("failure_reason"),
        retry_label: s("retry_label"),
        notes: s("notes"),
        status: s("status"),
        next_action: s("next_action"),
        completed: s("completed"),
        processor: s("processor"),
        customer_id: s("customer_id"),
        retry_eligible: n("retry_eligible") == 1,
        occurrence_count: std::cmp::max(n("occurrence_count"), 1),
        webhook_synced_at: s("webhook_synced_at"),
        webhook_last_status: r.get("webhook_last_status").and_then(|v| v.as_i64()),
        created_at: s("created_at"),
        updated_at: s("updated_at"),
        last_seen_at: s("last_seen_at"),
    }
}

// ─── Pull orchestrator ────────────────────────────────────────────────────

async fn run_failed_payment_pull(
    state: &AppState,
    dry_run: bool,
    merchant_limit: i64,
    days_back: i64,
) -> AppResult<PullResult> {
    let merchants = list_active_failed_merchants(state).await?;
    let mut merchant_results: Vec<Value> = Vec::new();
    let mut pulled: Vec<NormalizedEvent> = Vec::new();

    for m in &merchants {
        let gateway = normalize_failed_gateway(&m.gateway);
        let pulled_result = if gateway == "square" {
            pull_square(m, days_back).await
        } else {
            pull_nmi_like(m, days_back).await
        };
        match pulled_result {
            Ok(events) => {
                merchant_results.push(json!({
                    "merchantId": m.id,
                    "merchantName": m.merchant_name,
                    "gateway": m.gateway,
                    "ok": true,
                    "count": events.len(),
                }));
                pulled.extend(events);
            }
            Err(e) => merchant_results.push(json!({
                "merchantId": m.id,
                "merchantName": m.merchant_name,
                "gateway": m.gateway,
                "ok": false,
                "count": 0,
                "error": e.to_string(),
            })),
        }
    }

    let pulled_count = pulled.len() as i64;

    // Dedupe by transactionId, preserving last seen.
    let mut dedup: HashMap<String, NormalizedEvent> = HashMap::new();
    for ev in pulled {
        if ev.transaction_id.is_empty() { continue; }
        dedup.insert(ev.transaction_id.clone(), ev);
    }
    let mut unique: Vec<NormalizedEvent> = dedup.into_values().collect();
    if unique.len() as i64 > merchant_limit {
        unique.truncate(merchant_limit as usize);
    }
    let deduped_count = unique.len() as i64;

    if dry_run {
        let events_preview: Vec<Value> = unique.iter().map(|e| json!({
            "transactionId": e.transaction_id,
            "eventAt": e.event_at,
            "clientName": e.client_name,
            "email": e.email,
            "amountCents": e.amount_cents,
            "failureReason": e.failure_reason,
            "status": e.status,
            "processor": e.processor,
        })).collect();
        return Ok(PullResult {
            merchants_scanned: merchants.len() as i64,
            merchant_results,
            pulled_count,
            deduped_count,
            upserted_count: 0,
            events: events_preview,
        });
    }

    let mut upserted = 0;
    for ev in &unique {
        if upsert_event(state, ev).await.is_ok() {
            upserted += 1;
        }
    }
    Ok(PullResult {
        merchants_scanned: merchants.len() as i64,
        merchant_results,
        pulled_count,
        deduped_count,
        upserted_count: upserted,
        events: vec![],
    })
}

async fn upsert_event(state: &AppState, e: &NormalizedEvent) -> AppResult<()> {
    let rec_id = payment_event_record_id(OWNER, &e.transaction_id);
    let now = now_rfc3339();
    // First upsert with occurrence_count=1, then recalc.
    state.db.query("UPSERT type::thing('payment_events', $rid) SET \
            owner_key = $o, transaction_id = $tx, event_at = $ea, \
            client_name = $cn, email = $em, phone = $ph, \
            amount_cents = $amt, card_last4 = $l4, payment_method = $pm, \
            failure_reason = $fr, retry_label = $rl, notes = $nt, \
            status = $st, next_action = $na, completed = $cmp, \
            processor = $proc, customer_id = $cid, \
            retry_eligible = $re, \
            occurrence_count = IF occurrence_count THEN occurrence_count ELSE 1 END, \
            webhook_synced_at = webhook_synced_at, \
            created_at = IF created_at THEN created_at ELSE $now END, \
            updated_at = $now, last_seen_at = $now")
        .bind(("rid", rec_id.clone()))
        .bind(("o", OWNER))
        .bind(("tx", e.transaction_id.clone()))
        .bind(("ea", e.event_at.clone()))
        .bind(("cn", e.client_name.clone()))
        .bind(("em", e.email.clone()))
        .bind(("ph", e.phone.clone()))
        .bind(("amt", e.amount_cents))
        .bind(("l4", e.card_last4.clone()))
        .bind(("pm", e.payment_method.clone()))
        .bind(("fr", e.failure_reason.clone()))
        .bind(("rl", e.retry_label.clone()))
        .bind(("nt", e.notes.clone()))
        .bind(("st", e.status.clone()))
        .bind(("na", e.next_action.clone()))
        .bind(("cmp", e.completed.clone()))
        .bind(("proc", e.processor.clone()))
        .bind(("cid", e.customer_id.clone()))
        .bind(("re", if e.retry_eligible { 1i64 } else { 0 }))
        .bind(("now", now))
        .await?;

    // Recompute occurrence count for this client identity.
    let occ = calculate_occurrence_count(state, e).await.unwrap_or(1);
    let status_label = if occ <= 1 { "Failed".to_string() } else { format!("Failed x{occ}") };
    state.db.query(
        "UPDATE type::thing('payment_events', $rid) SET occurrence_count = $oc, status = $st, updated_at = time::now()")
        .bind(("rid", rec_id))
        .bind(("oc", occ))
        .bind(("st", status_label))
        .await?;
    Ok(())
}

async fn calculate_occurrence_count(state: &AppState, e: &NormalizedEvent) -> AppResult<i64> {
    let email = e.email.trim().to_lowercase();
    let cid = e.customer_id.trim().to_string();
    let name = normalize_name(&e.client_name).to_lowercase();
    #[derive(Deserialize)] struct R { email: Option<String>, customer_id: Option<String>, client_name: Option<String> }
    let mut __resp = state.db
        .query("SELECT email, customer_id, client_name FROM payment_events WHERE owner_key = $o")
        .bind(("o", OWNER))
        .await?;
    let rows: Vec<R> = crate::db::take_many(&mut __resp, 0)?;
    let count = if !email.is_empty() {
        rows.iter().filter(|r| r.email.as_deref().unwrap_or("").trim().to_lowercase() == email).count()
    } else if !cid.is_empty() {
        rows.iter().filter(|r| r.customer_id.as_deref().unwrap_or("").trim() == cid).count()
    } else if !name.is_empty() {
        rows.iter().filter(|r| normalize_name(r.client_name.as_deref().unwrap_or("")).to_lowercase() == name).count()
    } else {
        1
    };
    Ok(std::cmp::max(count as i64, 1))
}

// ─── Square pull (paginated) ──────────────────────────────────────────────

async fn pull_square(m: &MerchantRow, days_back: i64) -> AppResult<Vec<NormalizedEvent>> {
    let token = m.transaction_key.as_deref().unwrap_or("").trim();
    if token.is_empty() {
        return Ok(Vec::new());
    }
    let lookback = days_back.clamp(1, 30);
    let begin = (time::OffsetDateTime::now_utc() - time::Duration::days(lookback))
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let client = reqwest::Client::new();
    let mut cursor: Option<String> = None;
    let mut events: Vec<NormalizedEvent> = Vec::new();
    let retry_label = retry_label_for(m);
    let merchant_label = if m.merchant_name.is_empty() { "Square".into() } else { m.merchant_name.clone() };
    loop {
        let mut params: Vec<(&str, String)> = vec![
            ("begin_time", begin.clone()),
            ("sort_order", "DESC".into()),
            ("limit", "100".into()),
        ];
        if let Some(c) = &cursor { params.push(("cursor", c.clone())); }
        let resp = client
            .get("https://connect.squareup.com/v2/payments")
            .query(&params)
            .bearer_auth(token)
            .header("Square-Version", "2026-01-22")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
        let status = resp.status();
        let payload: Value = resp.json().await.unwrap_or(json!({}));
        if !status.is_success() {
            let detail = payload["errors"].as_array()
                .map(|errs| errs.iter()
                    .filter_map(|e| e["detail"].as_str().or(e["code"].as_str()))
                    .collect::<Vec<_>>().join("; "))
                .unwrap_or_default();
            return Err(AppError::Other(anyhow::anyhow!(
                "{merchant_label} API error ({status}){}",
                if detail.is_empty() { String::new() } else { format!(": {detail}") }
            )));
        }
        let empty: Vec<Value> = Vec::new();
        let payments = payload["payments"].as_array().unwrap_or(&empty);
        for p in payments {
            if p["status"].as_str().map(|s| s.to_uppercase()) != Some("FAILED".into()) {
                continue;
            }
            let errs_empty: Vec<Value> = Vec::new();
            let errs = p["card_details"]["errors"].as_array().unwrap_or(&errs_empty);
            let reason = errs.get(0)
                .and_then(|e| e["detail"].as_str().or(e["code"].as_str()))
                .or(p["delay_action"].as_str())
                .or(p["status"].as_str())
                .unwrap_or("FAILED")
                .trim()
                .to_string();
            let name = p["billing_details"]["name"].as_str()
                .or(p["billing_details"]["company_name"].as_str())
                .unwrap_or("Unknown")
                .trim()
                .to_string();
            events.push(normalize_event(EventInputs {
                transaction_id: p["id"].as_str().unwrap_or("").trim().to_string(),
                event_at: p["created_at"].as_str().unwrap_or("").trim().to_string(),
                client_name: name,
                email: p["billing_details"]["email_address"].as_str().unwrap_or("").trim().to_string(),
                phone: p["billing_details"]["phone_number"].as_str().unwrap_or("").trim().to_string(),
                amount_cents: p["amount_money"]["amount"].as_i64().unwrap_or(0),
                card_last4: p["card_details"]["card"]["last_4"].as_str().unwrap_or("").to_string(),
                payment_method: p["card_details"]["card"]["card_brand"].as_str().unwrap_or("Credit Card").trim().to_string(),
                failure_reason: reason,
                retry_label: retry_label.clone(),
                notes: errs.get(1).and_then(|e| e["code"].as_str()).unwrap_or("").to_string(),
                processor: merchant_label.clone(),
                customer_id: p["customer_id"].as_str().unwrap_or("").trim().to_string(),
            }));
        }
        cursor = payload["cursor"].as_str()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        if cursor.is_none() { break; }
    }
    Ok(events)
}

// ─── NMI / Bankcard pull (XML) ────────────────────────────────────────────

async fn pull_nmi_like(m: &MerchantRow, days_back: i64) -> AppResult<Vec<NormalizedEvent>> {
    let key = m.transaction_key.as_deref().unwrap_or("").trim();
    if key.is_empty() { return Ok(Vec::new()); }
    let lookback = days_back.clamp(1, 30);
    let now = time::OffsetDateTime::now_utc();
    let start = now - time::Duration::days(lookback);
    let body = format!(
        "security_key={}&condition=failed&report_type=transaction&start_date={}&end_date={}&result_limit=500",
        urlencode(key), fmt_nmi(&start), fmt_nmi(&now),
    );
    let client = reqwest::Client::new();
    let resp = client
        .post("https://secure.nmi.com/api/query.php")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let status = resp.status();
    let xml = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        let gateway = normalize_failed_gateway(&m.gateway);
        let label = if m.merchant_name.is_empty() {
            if gateway.is_empty() { "NMI".into() } else { gateway }
        } else { m.merchant_name.clone() };
        return Err(AppError::Other(anyhow::anyhow!("{label} query failed [http {status}]")));
    }
    let retry_label = retry_label_for(m);
    let processor = if m.merchant_name.is_empty() {
        if normalize_failed_gateway(&m.gateway) == "bankcard" { "Bankcard".into() } else { "NMI".into() }
    } else { m.merchant_name.clone() };

    let mut events: Vec<NormalizedEvent> = Vec::new();
    for tx_block in extract_xml_blocks(&xml, "transaction") {
        let action_blocks = extract_xml_blocks(&tx_block, "action");
        let latest = action_blocks.last().cloned().unwrap_or_default();
        let action_date = parse_nmi_ts(&extract_xml_tag(&latest, "date"));
        let amount = extract_xml_tag(&latest, "amount");
        let amount = if amount.is_empty() {
            extract_xml_tag(&latest, "requested_amount")
        } else { amount };
        let reason = first_non_empty(&[
            extract_xml_tag(&latest, "response_text"),
            extract_xml_tag(&latest, "processor_response_text"),
            extract_xml_tag(&tx_block, "condition"),
            "Failed".into(),
        ]);
        let first = extract_xml_tag(&tx_block, "first_name");
        let last = extract_xml_tag(&tx_block, "last_name");
        let mut name = format!("{first} {last}").trim().to_string();
        if name.is_empty() { name = extract_xml_tag(&tx_block, "company"); }
        if name.is_empty() { name = "Unknown".into(); }
        let customer_id = first_non_empty(&[
            extract_xml_tag(&tx_block, "customerid"),
            extract_xml_tag(&tx_block, "customer_vault_id"),
        ]);
        let tx_id = extract_xml_tag(&tx_block, "transaction_id");
        let cc_number = extract_xml_tag(&tx_block, "cc_number");
        let last4 = if cc_number.len() >= 4 { cc_number[cc_number.len()-4..].to_string() } else { String::new() };
        let pay_method = first_non_empty(&[extract_xml_tag(&tx_block, "cc_type"), "Credit Card".into()]);
        let event_at = if action_date.is_empty() { now_rfc3339() } else { action_date };

        events.push(normalize_event(EventInputs {
            transaction_id: tx_id,
            event_at,
            client_name: name,
            email: extract_xml_tag(&tx_block, "email"),
            phone: extract_xml_tag(&tx_block, "phone"),
            amount_cents: parse_money_to_cents(&amount),
            card_last4: last4,
            payment_method: pay_method,
            failure_reason: reason,
            retry_label: retry_label.clone(),
            notes: extract_xml_tag(&latest, "response_code"),
            processor: processor.clone(),
            customer_id,
        }));
    }
    Ok(events.into_iter().filter(|e| !e.transaction_id.is_empty()).collect())
}

// ─── Webhook send ─────────────────────────────────────────────────────────

async fn send_failed_payment_webhook(
    event: &FailedEventOut,
    billing: &BillingIntegration,
) -> AppResult<WebhookOutcome> {
    let payload = json!({
        "event": "failed_payment",
        "sourceSystem": "ninja-tools",
        "source": "ninja-tools",
        "workflow": "BTCP | Failed Payment",
        "synced_at": now_rfc3339(),
        "trigger_secret": billing.script_trigger_secret,
        "transaction_id": event.transaction_id,
        "failed_at": event.event_at,
        "client_name": event.client_name,
        "email": event.email,
        "phone": event.phone,
        "amount": event.amount_cents as f64 / 100.0,
        "card_last4": event.card_last4,
        "method": event.payment_method,
        "reason": event.failure_reason,
        "retry_label": event.retry_label,
        "status": event.status,
        "next_action": event.next_action,
        "completed": event.completed,
        "processor": event.processor,
        "customer_id": event.customer_id,
        "occurrence_count": event.occurrence_count,
        "notes": event.notes,
    });
    let mut req = reqwest::Client::new()
        .post(&billing.failed_payments_webhook_url)
        .header("accept", "application/json")
        .header("content-type", "application/json");
    if !billing.webhook_header_name.is_empty() && !billing.webhook_header_value.is_empty() {
        req = req.header(billing.webhook_header_name.as_str(), billing.webhook_header_value.as_str());
    }
    if !billing.script_trigger_secret.is_empty() {
        req = req.header("x-script-trigger-secret", billing.script_trigger_secret.as_str());
    }
    let resp = req.json(&payload).send().await.map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    Ok(WebhookOutcome {
        transaction_id: event.transaction_id.clone(),
        name: event.client_name.clone(),
        ok: (200..300).contains(&status),
        status,
        response_body: Some(body.chars().take(500).collect()),
        error: None,
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

struct EventInputs {
    transaction_id: String,
    event_at: String,
    client_name: String,
    email: String,
    phone: String,
    amount_cents: i64,
    card_last4: String,
    payment_method: String,
    failure_reason: String,
    retry_label: String,
    notes: String,
    processor: String,
    customer_id: String,
}

fn normalize_event(i: EventInputs) -> NormalizedEvent {
    let reason = if i.failure_reason.trim().is_empty() { "Unknown Failure".into() } else { i.failure_reason.trim().to_string() };
    let retry_elig = is_retry_eligible(&reason);
    let next_action = if retry_elig { "Retry".into() } else { "Review".into() };
    NormalizedEvent {
        transaction_id: i.transaction_id.trim().to_string(),
        event_at: if i.event_at.trim().is_empty() { now_rfc3339() } else { i.event_at.trim().to_string() },
        client_name: normalize_name(&i.client_name),
        email: i.email.trim().to_string(),
        phone: i.phone.trim().to_string(),
        amount_cents: i.amount_cents,
        card_last4: i.card_last4,
        payment_method: i.payment_method,
        failure_reason: reason,
        retry_label: i.retry_label,
        notes: i.notes,
        status: "Failed".into(),
        next_action,
        completed: "No".into(),
        processor: i.processor,
        customer_id: i.customer_id,
        retry_eligible: retry_elig,
    }
}

fn payment_event_record_id(owner: &str, tx: &str) -> String {
    let raw = format!("{owner}_{tx}");
    raw.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect()
}

fn retry_label_for(m: &MerchantRow) -> String {
    let retries = m.allowed_retries.unwrap_or(3).clamp(0, 999);
    let freq = m.retry_frequency_days.unwrap_or(7).clamp(1, 365);
    format!("{retries} / {freq}d")
}

fn normalize_failed_gateway(value: &str) -> String {
    let g = value.trim().to_lowercase();
    if g.is_empty() { return String::new(); }
    if g.contains("square") { return "square".into(); }
    if g.contains("nmi") { return "nmi".into(); }
    if g.contains("bankcard") { return "bankcard".into(); }
    g
}

fn is_retry_eligible(value: &str) -> bool {
    let r = value.trim().to_lowercase();
    if r.is_empty() { return false; }
    ["insufficient","not sufficient","do not honor","expired","declined","limit","exceeded","transaction_limit","funds"]
        .iter().any(|kw| r.contains(kw))
}

fn normalize_name(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}

fn extract_xml_blocks(xml: &str, tag: &str) -> Vec<String> {
    let pat = format!(r"<{tag}>([\s\S]*?)</{tag}>");
    Regex::new(&pat)
        .ok()
        .map(|re| re.captures_iter(xml).map(|c| c[1].to_string()).collect())
        .unwrap_or_default()
}

fn extract_xml_tag(xml: &str, tag: &str) -> String {
    let pat = format!(r"<{tag}>([\s\S]*?)</{tag}>");
    Regex::new(&pat)
        .ok()
        .and_then(|re| re.captures(xml).map(|c| decode_xml_entities(&c[1]).trim().to_string()))
        .unwrap_or_default()
}

fn decode_xml_entities(s: &str) -> String {
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

fn first_non_empty(items: &[String]) -> String {
    for s in items {
        let t = s.trim();
        if !t.is_empty() { return t.to_string(); }
    }
    String::new()
}

fn fmt_nmi(d: &time::OffsetDateTime) -> String {
    format!("{:04}{:02}{:02}{:02}{:02}{:02}",
        d.year(), u8::from(d.month()), d.day(), d.hour(), d.minute(), d.second())
}

fn parse_nmi_ts(s: &str) -> String {
    let raw = s.trim();
    if raw.len() != 14 || !raw.chars().all(|c| c.is_ascii_digit()) {
        return String::new();
    }
    let parse = |a: usize, b: usize| raw[a..b].parse::<i32>().ok();
    let (Some(y), Some(mo), Some(d), Some(h), Some(mi), Some(se)) = (
        parse(0,4), parse(4,6), parse(6,8), parse(8,10), parse(10,12), parse(12,14),
    ) else { return String::new() };
    let date = time::Date::from_calendar_date(y, time::Month::try_from(mo as u8).ok().unwrap_or(time::Month::January), d as u8);
    let time = time::Time::from_hms(h as u8, mi as u8, se as u8);
    if let (Ok(date), Ok(time)) = (date, time) {
        let dt = time::OffsetDateTime::new_utc(date, time);
        dt.format(&time::format_description::well_known::Rfc3339).unwrap_or_default()
    } else {
        String::new()
    }
}

fn parse_money_to_cents(s: &str) -> i64 {
    let trimmed = s.trim().replace(['$', ',', ' '], "");
    if let Ok(n) = trimmed.parse::<f64>() {
        return (n * 100.0).round() as i64;
    }
    0
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn now_rfc3339() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}
