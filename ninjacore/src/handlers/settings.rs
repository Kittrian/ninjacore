//! Business settings + integrations.
//!
//! Mirrors server.mjs:
//!   GET/PUT  /api/business-settings
//!   GET      /api/integrations
//!   PUT      /api/integrations/:service
//!
//! Storage matches the legacy layout: a single `settings` table with
//! `setting_key` (string) + `value_json` (string) so the existing data on
//! Hetzner SurrealDB is read/written without migration.

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const BUSINESS_SETTINGS_KEY: &str = "business.settings";

const INTEGRATION_SERVICES: &[&str] = &[
    "smartcredit35540",
    "smartcredit68951",
    "myfreescorenow",
    "gohighlevel",
    "billing",
    "ninjadispute",
    "contabo",
];

#[derive(Debug, Serialize, Deserialize)]
struct SettingRow {
    setting_key: String,
    value_json: String,
}

async fn load_setting(state: &AppState, key: &str) -> AppResult<Option<Value>> {
    let mut __resp = state
        .db
        .query("SELECT setting_key, value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await?;
    let row: Option<SettingRow> = crate::db::take_one(&mut __resp, 0)?;
    Ok(row.and_then(|r| serde_json::from_str::<Value>(&r.value_json).ok()))
}

async fn upsert_setting(state: &AppState, key: &str, value: &Value) -> AppResult<()> {
    let json = serde_json::to_string(value)
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    state
        .db
        .query(
            "UPSERT settings:[$k] SET setting_key = $k, value_json = $v, updated_at = time::now()",
        )
        .bind(("k", key.to_string()))
        .bind(("v", json))
        .await?;
    Ok(())
}

// ─── business-settings ────────────────────────────────────────────────────

pub async fn get_business_settings(
    _user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let settings = load_setting(&state, BUSINESS_SETTINGS_KEY)
        .await?
        .unwrap_or_else(|| json!({}));
    Ok(Json(json!({ "ok": true, "settings": settings })))
}

#[derive(Deserialize)]
pub struct BusinessSettingsBody {
    #[serde(default)]
    pub settings: Value,
}

pub async fn put_business_settings(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<BusinessSettingsBody>,
) -> AppResult<Json<Value>> {
    let mut current = load_setting(&state, BUSINESS_SETTINGS_KEY)
        .await?
        .unwrap_or_else(|| json!({}));
    merge_json(&mut current, &body.settings);
    upsert_setting(&state, BUSINESS_SETTINGS_KEY, &current).await?;
    Ok(Json(json!({ "ok": true, "settings": current })))
}

fn merge_json(dst: &mut Value, src: &Value) {
    match (dst, src) {
        (Value::Object(d), Value::Object(s)) => {
            for (k, v) in s {
                merge_json(d.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (d, s) => *d = s.clone(),
    }
}

// ─── integrations ─────────────────────────────────────────────────────────

pub async fn list_integrations(
    _user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let keys: Vec<String> = INTEGRATION_SERVICES
        .iter()
        .map(|s| format!("integration.{s}"))
        .collect();

    let mut __resp = state
        .db
        .query("SELECT setting_key, value_json FROM settings WHERE setting_key INSIDE $keys")
        .bind(("keys", keys))
        .await?;
    let rows: Vec<SettingRow> = crate::db::take_many(&mut __resp, 0)?;

    let mut map: HashMap<String, Value> = HashMap::new();
    for row in rows {
        let svc = row.setting_key.trim_start_matches("integration.").to_string();
        let parsed: Value = serde_json::from_str(&row.value_json).unwrap_or(json!({}));
        map.insert(svc, parsed);
    }

    let mut out = serde_json::Map::new();
    for svc in INTEGRATION_SERVICES {
        out.insert((*svc).into(), map.remove(*svc).unwrap_or(json!({})));
    }
    Ok(Json(json!({ "integrations": out })))
}

pub async fn put_integration(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(service): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let service = service.trim().to_lowercase();
    if !INTEGRATION_SERVICES.iter().any(|s| **s == service) {
        return Err(AppError::BadRequest("unsupported integration service".into()));
    }
    let key = format!("integration.{service}");
    upsert_setting(&state, &key, &body).await?;
    Ok(Json(json!({ "ok": true, "service": service, "integration": body })))
}
