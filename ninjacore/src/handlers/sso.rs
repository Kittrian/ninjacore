//! /api/auth/sso-login — accept a token from auth.ninjadispute.com, set txn cookie.
//!
//! Flow mirrors server.mjs:
//!   1. If caller already has a valid session cookie, short-circuit.
//!   2. Otherwise read token from body.token (cookie fallback).
//!   3. Verify via auth.ninjadispute.com/verify (EdDSA).
//!   4. (HS256 api.ninjadispute.com fallback — left as TODO; needs the shared secret.)

use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue};
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::{build_cookie, issue_token, AuthUser};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const SSO_TTL_SECS: i64 = 3600;

#[derive(Deserialize, Default)]
pub struct SsoBody {
    #[serde(default)] pub token: Option<String>,
}

pub async fn sso_login(
    State(state): State<AppState>,
    existing: Option<AuthUser>,
    Json(body): Json<SsoBody>,
) -> AppResult<impl IntoResponse> {
    // Short-circuit if already authenticated.
    if let Some(user) = existing {
        return Ok((HeaderMap::new(), Json(json!({
            "authenticated": true, "user": user.username,
        }))));
    }

    let token = body.token.unwrap_or_default();
    let token = token.trim();
    if token.is_empty() {
        return Err(AppError::Unauthorized);
    }

    let client = crate::http::shared();
    let resp = client
        .get("https://auth.ninjadispute.com/verify")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Unauthorized);
    }
    let data: Value = resp.json().await.unwrap_or(json!({}));
    if !data["authenticated"].as_bool().unwrap_or(false) {
        return Err(AppError::Unauthorized);
    }
    let username = data["username"]
        .as_str()
        .or_else(|| data["email"].as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if username.is_empty() {
        return Err(AppError::Unauthorized);
    }

    let issued = issue_token(&state, &username, SSO_TTL_SECS).map_err(AppError::Other)?;
    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&build_cookie(&issued, SSO_TTL_SECS))
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?,
    );
    Ok((headers, Json(json!({ "authenticated": true, "user": username }))))
}
