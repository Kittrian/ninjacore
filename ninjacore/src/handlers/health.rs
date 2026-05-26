use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};

use crate::state::AppState;

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let db_ok = state.db.health().await.is_ok();
    Json(json!({
        "ok": true,
        "service": "ninjacore",
        "db": db_ok,
        "sessions": state.sessions.len(),
        "chunks": state.chunks.len(),
    }))
}
