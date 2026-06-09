//! Affiliate links.
//!
//!   GET /api/affiliate-links
//!   PUT /api/affiliate-links/credit-builder
//!   PUT /api/affiliate-links/credit-monitoring

use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::AuthUser;
use crate::error::AppResult;
use crate::state::AppState;

const KEY_BUILDER: &str = "affiliate.creditBuilder";
const KEY_MONITORING: &str = "affiliate.creditMonitoring";

#[derive(Deserialize)]
struct SettingRow {
    value_json: String,
}

async fn load(state: &AppState, key: &str) -> AppResult<Value> {
    let mut resp = state
        .db
        .query("SELECT value_json FROM settings WHERE setting_key = $k LIMIT 1")
        .bind(("k", key.to_string()))
        .await?;
    let row: Option<SettingRow> = crate::db::take_one(&mut resp, 0)?;
    Ok(row
        .and_then(|r| serde_json::from_str(&r.value_json).ok())
        .unwrap_or(json!([])))
}

async fn save(state: &AppState, key: &str, value: &Value) -> AppResult<()> {
    let payload = serde_json::to_string(value).unwrap_or("[]".into());
    state
        .db
        .query(
            "UPSERT settings:[$k] SET setting_key = $k, value_json = $v, updated_at = time::now()",
        )
        .bind(("k", key.to_string()))
        .bind(("v", payload))
        .await?;
    Ok(())
}

pub async fn list_links(_user: AuthUser, State(state): State<AppState>) -> AppResult<Json<Value>> {
    let builder = load(&state, KEY_BUILDER).await?;
    let monitoring = load(&state, KEY_MONITORING).await?;
    Ok(Json(json!({
        "affiliateLinks": {
            "creditBuilder": builder,
            "creditMonitoring": monitoring,
        }
    })))
}

#[derive(Deserialize)]
pub struct LinksBody {
    #[serde(default)]
    pub rows: Value,
}

pub async fn put_builder(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<LinksBody>,
) -> AppResult<Json<Value>> {
    save(&state, KEY_BUILDER, &body.rows).await?;
    Ok(Json(json!({ "ok": true, "rows": body.rows })))
}

pub async fn put_monitoring(
    _user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<LinksBody>,
) -> AppResult<Json<Value>> {
    save(&state, KEY_MONITORING, &body.rows).await?;
    Ok(Json(json!({ "ok": true, "rows": body.rows })))
}
