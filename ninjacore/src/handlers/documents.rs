//! Document proxy + R2 migration admin.
//!
//!   GET  /api/documents/proxy?key=...           — stream from R2/Contabo with auth
//!   POST /api/admin/migrate-documents-to-s3     — STUB (large migration job)

use axum::body::Body;
use axum::extract::Query;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};

#[derive(Deserialize)]
pub struct DocQuery {
    #[serde(default)]
    pub key: Option<String>,
}

/// Streams an object out of Cloudflare R2.
///
/// Auth: requires server-side credentials in env:
///   R2_PUBLIC_BASE  e.g. https://<bucket>.r2.cloudflarestorage.com/<bucket>
///   R2_BEARER       optional pre-signed bearer for authenticated access via Worker
///
/// If a Cloudflare Worker fronts R2 (per the arch memory), set R2_PUBLIC_BASE to
/// the Worker URL and R2_BEARER to the shared secret the Worker checks.
pub async fn proxy(
    _user: AuthUser,
    Query(q): Query<DocQuery>,
) -> AppResult<Response> {
    let key = q.key.unwrap_or_default();
    let key = key.trim();
    if key.is_empty() {
        return Err(AppError::BadRequest("Missing document key.".into()));
    }

    let base = std::env::var("R2_PUBLIC_BASE")
        .map_err(|_| AppError::BadRequest("R2_PUBLIC_BASE not configured.".into()))?;
    let url = format!("{}/{}", base.trim_end_matches('/'), key.trim_start_matches('/'));

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Ok(bearer) = std::env::var("R2_BEARER") {
        if !bearer.is_empty() {
            req = req.bearer_auth(bearer);
        }
    }

    let upstream = req.send().await.map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let status = upstream.status();

    if !status.is_success() {
        let body = upstream.text().await.unwrap_or_else(|_| "Document fetch failed.".into());
        let mut h = HeaderMap::new();
        h.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain; charset=utf-8"));
        h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        return Ok((
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            h,
            body,
        )
            .into_response());
    }

    // Forward content-type/length/etag/last-modified, stream body.
    let mut headers = HeaderMap::new();
    for h in [
        header::CONTENT_TYPE,
        header::CONTENT_LENGTH,
        header::ETAG,
        header::LAST_MODIFIED,
    ] {
        if let Some(v) = upstream.headers().get(&h) {
            headers.insert(h, v.clone());
        }
    }
    if !headers.contains_key(header::CONTENT_TYPE) {
        let guess = mime_guess::from_path(key).first_or_octet_stream();
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_str(guess.essence_str()).unwrap(),
        );
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("private, max-age=300"));

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);
    Ok((StatusCode::OK, headers, body).into_response())
}

pub async fn migrate_to_s3(_user: AuthUser) -> AppResult<Json<serde_json::Value>> {
    Err(AppError::NotImplemented(
        "admin/migrate-documents-to-s3 needs persistClientDocumentsToS3 + \
         normalizeClientDocumentsInput ported from server.mjs along with the \
         Contabo→R2 transfer pipeline."
            .into(),
    ))?;
    Ok(Json(json!({})))
}
