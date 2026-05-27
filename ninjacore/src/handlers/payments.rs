//! Payments — overview + CRUD for merchants/products/autopay + Square smoke test.
//!
//! Routes mirror server.mjs:
//!   GET    /api/payments/overview
//!   PUT    /api/payments/config
//!   POST   /api/payments/merchants            PUT/DELETE /api/payments/merchants/:id
//!   POST   /api/payments/test-square
//!   POST   /api/payments/products             PUT/DELETE /api/payments/products/:id
//!   POST   /api/payments/autopay              PUT/DELETE /api/payments/autopay/:id
//!
//! Owner key: matches server.mjs `normalizeOwnerKey` — always "admin" until a
//! private-business override exists. Accepted via `?owner=` or `x-owner-key`
//! but ignored for now.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const OWNER_KEY: &str = "admin";

// ─── Config ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentConfig {
    #[serde(default = "default_retry_count")]
    pub default_retry_count: i64,
    #[serde(default = "default_retry_freq")]
    pub default_retry_frequency_days: i64,
    #[serde(default = "default_run_time")]
    pub default_run_time_local: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
}

fn default_retry_count() -> i64 { 3 }
fn default_retry_freq() -> i64 { 7 }
fn default_run_time() -> String { "09:00".into() }
fn default_timezone() -> String { "America/Chicago".into() }

impl Default for PaymentConfig {
    fn default() -> Self {
        Self {
            default_retry_count: default_retry_count(),
            default_retry_frequency_days: default_retry_freq(),
            default_run_time_local: default_run_time(),
            timezone: default_timezone(),
        }
    }
}

// No `payment_config` table in live schema — store JSON-encoded under `settings`.
const CONFIG_KEY: &str = "payments.config";

async fn load_payment_config(state: &AppState) -> AppResult<PaymentConfig> {
    #[derive(Deserialize)] struct Row { value_json: String }
    let mut __resp = state.db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", CONFIG_KEY))
        .await?;
    let row: Option<Row> = crate::db::take_one(&mut __resp, 0)?;
    Ok(row
        .and_then(|r| serde_json::from_str::<PaymentConfig>(&r.value_json).ok())
        .unwrap_or_default())
}

async fn save_payment_config(state: &AppState, cfg: &PaymentConfig) -> AppResult<()> {
    let payload = serde_json::to_string(cfg)
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    state.db
        .query("UPSERT settings:[$k] SET setting_key = $k, value_json = $v, updated_at = time::now()")
        .bind(("k", CONFIG_KEY))
        .bind(("v", payload))
        .await?;
    Ok(())
}

// ─── Entities ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Merchant {
    pub id: i64,
    pub merchant_name: String,
    #[serde(default)]
    pub gateway: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub login_id: Option<String>,
    #[serde(default)]
    pub transaction_key: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: i64,
    pub product_name: String,
    #[serde(default)]
    pub amount: f64,
    #[serde(default)]
    pub frequency: String,
    #[serde(default)]
    pub merchant_id: Option<i64>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Autopay {
    pub id: i64,
    pub client_id: String,
    #[serde(default)]
    pub merchant_id: Option<i64>,
    #[serde(default)]
    pub product_id: Option<i64>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub next_charge_at: Option<String>,
    #[serde(default)]
    pub amount: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentClient {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct OwnerQuery {
    #[serde(default)]
    pub owner: Option<String>,
}

// ─── Generic CRUD helpers ─────────────────────────────────────────────────

async fn next_id(state: &AppState, table: &str) -> AppResult<i64> {
    let mut resp = state
        .db
        .query(format!("SELECT VALUE math::max(id) FROM {table} WHERE owner_key = $o GROUP ALL"))
        .bind(("o", OWNER_KEY))
        .await?;
    let max: Option<i64> = crate::db::take_one(&mut resp, 0)?;
    Ok(max.unwrap_or(0) + 1)
}

async fn list_merchants(state: &AppState) -> AppResult<Vec<Merchant>> {
    let mut resp = state
        .db
        .query("SELECT * FROM merchants WHERE owner_key = $o ORDER BY id")
        .bind(("o", OWNER_KEY))
        .await?;
    crate::db::take_many(&mut resp, 0)
}

async fn list_products(state: &AppState) -> AppResult<Vec<Product>> {
    let mut resp = state
        .db
        .query("SELECT * FROM products WHERE owner_key = $o ORDER BY id")
        .bind(("o", OWNER_KEY))
        .await?;
    crate::db::take_many(&mut resp, 0)
}

async fn list_autopay(state: &AppState) -> AppResult<Vec<Autopay>> {
    let mut resp = state
        .db
        .query("SELECT * FROM autopay WHERE owner_key = $o ORDER BY id")
        .bind(("o", OWNER_KEY))
        .await?;
    crate::db::take_many(&mut resp, 0)
}

async fn list_payment_clients(state: &AppState) -> AppResult<Vec<PaymentClient>> {
    #[derive(Deserialize)]
    struct Row {
        id: String,
        first_name: Option<String>,
        last_name: Option<String>,
    }
    let mut resp = state
        .db
        .query("SELECT id, first_name, last_name FROM clients WHERE status = 'Client' ORDER BY last_name, first_name")
        .await?;
    let rows: Vec<Row> = crate::db::take_many(&mut resp, 0)?;
    Ok(rows
        .into_iter()
        .map(|r| PaymentClient {
            name: format!(
                "{} {}",
                r.first_name.clone().unwrap_or_default(),
                r.last_name.clone().unwrap_or_default()
            )
            .trim()
            .to_string(),
            id: r.id,
        })
        .collect())
}

// ─── Overview ─────────────────────────────────────────────────────────────

pub async fn overview(
    _user: AuthUser,
    State(state): State<AppState>,
    Query(_q): Query<OwnerQuery>,
) -> AppResult<Json<Value>> {
    let (config, merchants, products, autopay_rows, clients) = tokio::try_join!(
        load_payment_config(&state),
        list_merchants(&state),
        list_products(&state),
        list_autopay(&state),
        list_payment_clients(&state),
    )?;

    let client_name: HashMap<&str, &str> = clients.iter().map(|c| (c.id.as_str(), c.name.as_str())).collect();
    let merchant_name: HashMap<i64, &str> = merchants.iter().map(|m| (m.id, m.merchant_name.as_str())).collect();
    let product_name: HashMap<i64, &str> = products.iter().map(|p| (p.id, p.product_name.as_str())).collect();

    let now_ms = time::OffsetDateTime::now_utc().unix_timestamp() * 1000;
    let seven_days_ms = 7 * 24 * 60 * 60 * 1000;

    let active_count = autopay_rows.iter().filter(|r| r.status == "Active").count();
    let due_in_7 = autopay_rows
        .iter()
        .filter(|r| {
            r.next_charge_at
                .as_deref()
                .and_then(|s| time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339).ok())
                .map(|t| t.unix_timestamp() * 1000 <= now_ms + seven_days_ms)
                .unwrap_or(false)
        })
        .count();

    let autopay: Vec<Value> = autopay_rows
        .into_iter()
        .map(|r| {
            let cn = client_name.get(r.client_id.as_str()).copied().unwrap_or("Unknown Client").to_string();
            let mn = r.merchant_id.and_then(|i| merchant_name.get(&i).copied()).unwrap_or("--").to_string();
            let pn = r.product_id.and_then(|i| product_name.get(&i).copied()).unwrap_or("Custom Charge").to_string();
            let mut v = serde_json::to_value(&r).unwrap();
            v["clientName"] = Value::String(cn);
            v["merchantName"] = Value::String(mn);
            v["productName"] = Value::String(pn);
            v
        })
        .collect();

    let summary = json!({
        "merchantCount": merchants.len(),
        "productCount": products.len(),
        "autopayCount": autopay.len(),
        "activeAutopayCount": active_count,
        "dueIn7Days": due_in_7,
    });

    Ok(Json(json!({
        "ok": true,
        "ownerKey": OWNER_KEY,
        "config": config,
        "merchants": merchants,
        "products": products,
        "autopay": autopay,
        "clients": clients,
        "summary": summary,
        "gatewayOptions": ["Square", "Authorize.Net", "BTCPay", "NMI", "Other"],
        "frequencyOptions": ["Weekly", "Bi-Weekly", "Monthly", "Quarterly", "Annual", "One-Time"],
    })))
}

// ─── Config PUT ───────────────────────────────────────────────────────────

pub async fn put_config(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(cfg): Json<PaymentConfig>,
) -> AppResult<Json<Value>> {
    save_payment_config(&state, &cfg).await?;
    Ok(Json(json!({ "ok": true, "ownerKey": OWNER_KEY, "config": cfg })))
}

// ─── Merchants CRUD ───────────────────────────────────────────────────────

pub async fn create_merchant(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(mut body): Json<Merchant>,
) -> AppResult<(StatusCode, Json<Value>)> {
    body.id = next_id(&state, "merchants").await?;
    state
        .db
        .query("CREATE merchants SET owner_key = $o, id = $id, merchant_name = $name, gateway = $gw, status = $st, login_id = $lid, transaction_key = $tk, notes = $nt, created_at = time::now()")
        .bind(("o", OWNER_KEY))
        .bind(("id", body.id))
        .bind(("name", body.merchant_name.clone()))
        .bind(("gw", body.gateway.clone()))
        .bind(("st", body.status.clone()))
        .bind(("lid", body.login_id.clone()))
        .bind(("tk", body.transaction_key.clone()))
        .bind(("nt", body.notes.clone()))
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true, "merchant": body }))))
}

pub async fn update_merchant(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(mut body): Json<Merchant>,
) -> AppResult<Json<Value>> {
    body.id = id;
    let mut __resp = state
        .db
        .query("UPDATE merchants SET merchant_name = $name, gateway = $gw, status = $st, login_id = $lid, transaction_key = $tk, notes = $nt, updated_at = time::now() WHERE owner_key = $o AND id = $id RETURN AFTER")
        .bind(("o", OWNER_KEY))
        .bind(("id", id))
        .bind(("name", body.merchant_name.clone()))
        .bind(("gw", body.gateway.clone()))
        .bind(("st", body.status.clone()))
        .bind(("lid", body.login_id.clone()))
        .bind(("tk", body.transaction_key.clone()))
        .bind(("nt", body.notes.clone()))
        .await?;
    let updated: Option<Merchant> = crate::db::take_one(&mut __resp, 0)?;
    let m = updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true, "merchant": m })))
}

pub async fn delete_merchant(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let mut __resp = state
        .db
        .query("DELETE merchants WHERE owner_key = $o AND id = $id RETURN BEFORE")
        .bind(("o", OWNER_KEY))
        .bind(("id", id))
        .await?;
    let deleted: Option<Merchant> = crate::db::take_one(&mut __resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deleted": true })))
}

// ─── Products CRUD ────────────────────────────────────────────────────────

pub async fn create_product(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(mut body): Json<Product>,
) -> AppResult<(StatusCode, Json<Value>)> {
    body.id = next_id(&state, "products").await?;
    state
        .db
        .query("CREATE products SET owner_key = $o, id = $id, product_name = $name, amount = $amt, frequency = $fq, merchant_id = $mid, notes = $nt, created_at = time::now()")
        .bind(("o", OWNER_KEY))
        .bind(("id", body.id))
        .bind(("name", body.product_name.clone()))
        .bind(("amt", body.amount))
        .bind(("fq", body.frequency.clone()))
        .bind(("mid", body.merchant_id))
        .bind(("nt", body.notes.clone()))
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true, "product": body }))))
}

pub async fn update_product(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(mut body): Json<Product>,
) -> AppResult<Json<Value>> {
    body.id = id;
    let mut __resp = state
        .db
        .query("UPDATE products SET product_name = $name, amount = $amt, frequency = $fq, merchant_id = $mid, notes = $nt, updated_at = time::now() WHERE owner_key = $o AND id = $id RETURN AFTER")
        .bind(("o", OWNER_KEY))
        .bind(("id", id))
        .bind(("name", body.product_name.clone()))
        .bind(("amt", body.amount))
        .bind(("fq", body.frequency.clone()))
        .bind(("mid", body.merchant_id))
        .bind(("nt", body.notes.clone()))
        .await?;
    let updated: Option<Product> = crate::db::take_one(&mut __resp, 0)?;
    let p = updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true, "product": p })))
}

pub async fn delete_product(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let mut __resp = state
        .db
        .query("DELETE products WHERE owner_key = $o AND id = $id RETURN BEFORE")
        .bind(("o", OWNER_KEY))
        .bind(("id", id))
        .await?;
    let deleted: Option<Product> = crate::db::take_one(&mut __resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deleted": true })))
}

// ─── Autopay CRUD ─────────────────────────────────────────────────────────

pub async fn create_autopay(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(mut body): Json<Autopay>,
) -> AppResult<(StatusCode, Json<Value>)> {
    body.id = next_id(&state, "autopay").await?;
    state
        .db
        .query("CREATE autopay SET owner_key = $o, id = $id, client_id = $cid, merchant_id = $mid, product_id = $pid, status = $st, next_charge_at = $nc, amount = $amt, notes = $nt, created_at = time::now()")
        .bind(("o", OWNER_KEY))
        .bind(("id", body.id))
        .bind(("cid", body.client_id.clone()))
        .bind(("mid", body.merchant_id))
        .bind(("pid", body.product_id))
        .bind(("st", body.status.clone()))
        .bind(("nc", body.next_charge_at.clone()))
        .bind(("amt", body.amount))
        .bind(("nt", body.notes.clone()))
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "ok": true, "autopay": body }))))
}

pub async fn update_autopay(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(mut body): Json<Autopay>,
) -> AppResult<Json<Value>> {
    body.id = id;
    let mut __resp = state
        .db
        .query("UPDATE autopay SET client_id = $cid, merchant_id = $mid, product_id = $pid, status = $st, next_charge_at = $nc, amount = $amt, notes = $nt, updated_at = time::now() WHERE owner_key = $o AND id = $id RETURN AFTER")
        .bind(("o", OWNER_KEY))
        .bind(("id", id))
        .bind(("cid", body.client_id.clone()))
        .bind(("mid", body.merchant_id))
        .bind(("pid", body.product_id))
        .bind(("st", body.status.clone()))
        .bind(("nc", body.next_charge_at.clone()))
        .bind(("amt", body.amount))
        .bind(("nt", body.notes.clone()))
        .await?;
    let updated: Option<Autopay> = crate::db::take_one(&mut __resp, 0)?;
    let a = updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true, "autopay": a })))
}

pub async fn delete_autopay(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let mut __resp = state
        .db
        .query("DELETE autopay WHERE owner_key = $o AND id = $id RETURN BEFORE")
        .bind(("o", OWNER_KEY))
        .bind(("id", id))
        .await?;
    let deleted: Option<Autopay> = crate::db::take_one(&mut __resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deleted": true })))
}

// ─── Square smoke test ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct TestSquareBody {
    #[serde(default)]
    pub days_back: Option<i64>,
}

pub async fn test_square(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<TestSquareBody>,
) -> AppResult<Json<Value>> {
    let merchants = list_merchants(&state).await?;
    let square = merchants
        .iter()
        .find(|m| m.status == "Active" && m.gateway.to_lowercase() == "square")
        .ok_or_else(|| AppError::BadRequest("No active Square merchant found.".into()))?;

    let token = square
        .transaction_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::BadRequest("Square access token is missing on the selected merchant.".into()))?;

    let lookback = body.days_back.unwrap_or(2).clamp(1, 30);
    let begin_ts = time::OffsetDateTime::now_utc() - time::Duration::days(lookback);
    let begin_time = begin_ts
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let client = crate::http::shared();
    let resp = client
        .get("https://connect.squareup.com/v2/payments")
        .query(&[("begin_time", begin_time.as_str()), ("sort_order", "DESC"), ("limit", "25")])
        .bearer_auth(token)
        .header("Square-Version", "2025-10-16")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let status = resp.status();
    let payload: Value = resp.json().await.unwrap_or(json!({}));
    if !status.is_success() {
        let detail = payload["errors"]
            .as_array()
            .map(|errs| {
                errs.iter()
                    .filter_map(|e| e["detail"].as_str().or(e["code"].as_str()))
                    .collect::<Vec<_>>()
                    .join("; ")
            })
            .unwrap_or_default();
        return Err(AppError::BadRequest(format!(
            "Square API error ({status}){}",
            if detail.is_empty() { String::new() } else { format!(": {detail}") }
        )));
    }

    let empty: Vec<Value> = Vec::new();
    let payments = payload["payments"].as_array().unwrap_or(&empty);
    let sample: Vec<Value> = payments
        .iter()
        .take(5)
        .map(|e| {
            let amount_minor = e["amount_money"]["amount"].as_i64().unwrap_or(0);
            let currency = e["amount_money"]["currency"].as_str().unwrap_or("USD");
            json!({
                "id": e["id"].as_str().unwrap_or(""),
                "status": e["status"].as_str().unwrap_or(""),
                "amount": format!("{:.2} {}", amount_minor as f64 / 100.0, currency),
                "createdAt": e["created_at"].as_str().unwrap_or(""),
            })
        })
        .collect();

    Ok(Json(json!({
        "ok": true,
        "merchantName": square.merchant_name,
        "count": payments.len(),
        "summary": format!("merchant={}, lookback={}d", square.merchant_name, lookback),
        "sample": sample,
    })))
}
