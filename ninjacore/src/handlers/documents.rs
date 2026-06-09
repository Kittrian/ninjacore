//! Document proxy + R2 migration admin.
//!
//!   GET  /api/documents/proxy?key=...           — stream from R2/Worker with auth
//!   POST /api/admin/migrate-documents-to-s3     — STUB (large migration job)

use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Deserialize)]
pub struct DocQuery {
    #[serde(default)]
    pub key: Option<String>,
}

/// Headers the client may send that we want R2 to honor — enables 206 Partial
/// Content for ranged PDF reads and 304 Not Modified for cache revalidation.
const FORWARDED_REQ_HEADERS: &[HeaderName] = &[
    header::RANGE,
    header::IF_NONE_MATCH,
    header::IF_MODIFIED_SINCE,
    header::IF_MATCH,
    header::IF_UNMODIFIED_SINCE,
    header::ACCEPT_ENCODING,
];

/// Response headers we mirror back from R2 / the Worker.
const FORWARDED_RES_HEADERS: &[HeaderName] = &[
    header::CONTENT_TYPE,
    header::CONTENT_LENGTH,
    header::CONTENT_RANGE,
    header::CONTENT_ENCODING,
    header::ETAG,
    header::LAST_MODIFIED,
    header::ACCEPT_RANGES,
    header::VARY,
];

/// Streams an object out of Cloudflare R2 (directly, or via the ninjacore
/// R2 Worker if `R2_PUBLIC_BASE` points at the Worker).
///
/// Env:
///   R2_PUBLIC_BASE  e.g. https://r2.ninjadispute.com  (Worker)  or
///                       https://<bucket>.r2.cloudflarestorage.com/<bucket>
///   R2_BEARER       optional shared secret the Worker checks
pub async fn proxy(
    _user: AuthUser,
    State(state): State<AppState>,
    headers_in: HeaderMap,
    Query(q): Query<DocQuery>,
) -> AppResult<Response> {
    let key = q.key.unwrap_or_default();
    let key = key.trim();
    if key.is_empty() {
        return Err(AppError::BadRequest("Missing document key.".into()));
    }

    let base = std::env::var("R2_PUBLIC_BASE")
        .map_err(|_| AppError::BadRequest("R2_PUBLIC_BASE not configured.".into()))?;
    let url = format!(
        "{}/{}",
        base.trim_end_matches('/'),
        key.trim_start_matches('/')
    );

    // Reuse the process-wide pooled client — keeps the TLS+HTTP/2 session to
    // Cloudflare warm across requests instead of a fresh handshake every hit.
    let mut req = state.http.request(Method::GET, &url);
    if let Ok(bearer) = std::env::var("R2_BEARER") {
        if !bearer.is_empty() {
            req = req.bearer_auth(bearer);
        }
    }
    for h in FORWARDED_REQ_HEADERS {
        if let Some(v) = headers_in.get(h) {
            req = req.header(h.clone(), v.clone());
        }
    }

    let upstream = req
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let status = upstream.status();

    // 304 Not Modified — empty body, just mirror cache headers and return.
    if status == StatusCode::NOT_MODIFIED {
        let mut out = HeaderMap::new();
        for h in FORWARDED_RES_HEADERS {
            if let Some(v) = upstream.headers().get(h) {
                out.insert(h.clone(), v.clone());
            }
        }
        return Ok((StatusCode::NOT_MODIFIED, out).into_response());
    }

    // Non-success and non-206: surface the upstream error as plain text.
    if !status.is_success() && status != StatusCode::PARTIAL_CONTENT {
        let body = upstream
            .text()
            .await
            .unwrap_or_else(|_| "Document fetch failed.".into());
        let mut h = HeaderMap::new();
        h.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
        h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        return Ok((
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            h,
            body,
        )
            .into_response());
    }

    let mut out = HeaderMap::new();
    for h in FORWARDED_RES_HEADERS {
        if let Some(v) = upstream.headers().get(h) {
            out.insert(h.clone(), v.clone());
        }
    }
    if !out.contains_key(header::CONTENT_TYPE) {
        let guess = mime_guess::from_path(key).first_or_octet_stream();
        out.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_str(guess.essence_str()).unwrap(),
        );
    }
    // Browser cache for 5 minutes; the Worker (or R2 direct) already returns
    // strong ETag/Last-Modified for revalidation.
    out.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300, must-revalidate"),
    );

    let final_status = if status == StatusCode::PARTIAL_CONTENT {
        StatusCode::PARTIAL_CONTENT
    } else {
        StatusCode::OK
    };

    // Stream the upstream body straight to the client — no buffering, so a
    // 50 MB PDF starts flowing as soon as R2 sends its first chunk.
    let body = Body::from_stream(upstream.bytes_stream());
    Ok((final_status, out, body).into_response())
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
