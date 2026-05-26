use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::{
    build_cookie, clear_cookie, default_salt, hash_password_with_salt, issue_token,
    verify_password, AuthUser,
};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const SESSION_TTL_SECS: i64 = 30 * 24 * 60 * 60; // 30 days, mirrors server.mjs

#[derive(Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
    #[serde(default, rename = "confirmPassword")]
    pub confirm_password: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct UserRow {
    username: String,
    password_hash: String,
    #[serde(default)]
    password_salt: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<Credentials>,
) -> AppResult<impl IntoResponse> {
    let username = body.username.trim().to_lowercase();
    if username.is_empty() || body.password.is_empty() {
        return Err(AppError::BadRequest("username and password required".into()));
    }

    let mut resp = state
        .db
        .query("SELECT username, password_hash, password_salt FROM users WHERE username = $u LIMIT 1")
        .bind(("u", username.clone()))
        .await?;
    let user: Option<UserRow> = crate::db::take_one(&mut resp, 0)?;

    let Some(user) = user else {
        return Err(AppError::Unauthorized);
    };
    let salt = if user.password_salt.is_empty() { default_salt(&user.username) } else { user.password_salt.clone() };
    if !verify_password(&body.password, &salt, &user.password_hash) {
        return Err(AppError::Unauthorized);
    }

    let token = issue_token(&state, &user.username, SESSION_TTL_SECS)
        .map_err(AppError::Other)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&build_cookie(&token, SESSION_TTL_SECS))
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?,
    );
    Ok((StatusCode::OK, headers, Json(json!({
        "success": true,
        "user": user.username,
    }))))
}

pub async fn signup(
    State(state): State<AppState>,
    Json(body): Json<Credentials>,
) -> AppResult<impl IntoResponse> {
    let username = body.username.trim().to_lowercase();
    if username.is_empty() {
        return Err(AppError::BadRequest("username required".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest("password must be at least 8 characters".into()));
    }
    if let Some(c) = body.confirm_password.as_deref() {
        if !c.is_empty() && c != body.password {
            return Err(AppError::BadRequest("password confirmation does not match".into()));
        }
    }

    let salt = default_salt(&username);
    let hash = hash_password_with_salt(&salt, &body.password);

    let mut resp = state
        .db
        .query("CREATE type::thing('users', $u) SET username = $u, password_hash = $h, password_salt = $s, created_at = time::now(), updated_at = time::now()")
        .bind(("u", username.clone()))
        .bind(("h", hash))
        .bind(("s", salt))
        .await?;
    let _: Option<UserRow> = crate::db::take_one(&mut resp, 0)?;

    let token = issue_token(&state, &username, SESSION_TTL_SECS)
        .map_err(AppError::Other)?;
    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&build_cookie(&token, SESSION_TTL_SECS))
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?,
    );
    Ok((StatusCode::CREATED, headers, Json(json!({
        "success": true,
        "user": username,
    }))))
}

pub async fn logout() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&clear_cookie()).unwrap(),
    );
    (StatusCode::OK, headers, Json(json!({ "success": true })))
}

pub async fn auth_status(user: Option<AuthUser>) -> Json<serde_json::Value> {
    match user {
        Some(u) => Json(json!({ "authenticated": true, "user": u.username })),
        None => Json(json!({ "authenticated": false })),
    }
}
