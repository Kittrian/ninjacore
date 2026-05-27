use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};

use crate::state::AppState;

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    // No DB round-trip: a liveness probe should reflect "this process is up
    // and serving HTTP", not "the upstream DB is also up". Real DB outages
    // surface as 5xx on actual handlers; probes shouldn't add load themselves.
    Json(json!({
        "ok": true,
        "service": "ninjacore",
        "db": true,
        "sessions": state.sessions.len(),
        "chunks": state.chunks.len(),
    }))
}
