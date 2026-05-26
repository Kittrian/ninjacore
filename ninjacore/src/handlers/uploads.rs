//! Upload pipeline — direct-to-R2 with presigned URLs.
//!
//! Flow:
//!   1. Frontend POSTs to /api/uploads/presign with {clientId, type, fileName,
//!      contentType, size}.
//!   2. Backend returns {uploadUrl, key, headers, expiresAt}.
//!   3. Frontend PUTs the file bytes directly to R2 at uploadUrl with the
//!      signed Content-Type header. Backend never sees the bytes.
//!   4. Frontend POSTs to /api/clients/:id/documents/attach with the file
//!      metadata + key. Backend writes the document record to SurrealDB.
//!
//! Future: replace the presigned URL step with a Cloudflare Worker token
//! that gates uploads at the edge — see docs/migration-next.md.
//!
//!   POST /api/uploads/presign                       — issue presigned PUT
//!   POST /api/clients/:id/documents/attach          — record uploaded files

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::r2::{presign_put, public_url, R2Config};
use crate::state::AppState;

// ─── presign ──────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES: u64 = 32 * 1024 * 1024; // 32MB per file
const PRESIGN_TTL_SECS: u64 = 300; // 5 min

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignBody {
    pub client_id: String,
    pub doc_type: String,
    pub file_name: String,
    pub content_type: String,
    #[serde(default)]
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresignResponse {
    pub upload_url: String,
    pub key: String,
    pub public_url: String,
    pub expires_at: String,
    pub max_size: u64,
    pub headers: Vec<HeaderPair>,
}

#[derive(Debug, Serialize)]
pub struct HeaderPair {
    pub name: String,
    pub value: String,
}

pub async fn presign(
    user: AuthUser,
    State(_state): State<AppState>,
    Json(body): Json<PresignBody>,
) -> AppResult<Json<PresignResponse>> {
    if let Some(sz) = body.size {
        if sz == 0 {
            return Err(AppError::BadRequest("File size is required and must be > 0".into()));
        }
        if sz > MAX_UPLOAD_BYTES {
            return Err(AppError::BadRequest(format!(
                "File too large: {} bytes (max {})", sz, MAX_UPLOAD_BYTES
            )));
        }
    }
    let client_id = body.client_id.trim();
    if client_id.is_empty() {
        return Err(AppError::BadRequest("clientId is required".into()));
    }
    let doc_type = normalize_doc_type(&body.doc_type);
    let file_name = sanitize_file_name(&body.file_name);
    let content_type = body.content_type.trim();
    if content_type.is_empty() {
        return Err(AppError::BadRequest("contentType is required".into()));
    }
    if !is_safe_content_type(content_type) {
        return Err(AppError::BadRequest(format!(
            "Unsupported contentType: {content_type}"
        )));
    }

    let cfg = R2Config::from_env()
        .ok_or_else(|| AppError::Other(anyhow::anyhow!("R2 not configured (missing R2_ENDPOINT / R2_BUCKET / R2_ACCESS_KEY / R2_SECRET_KEY)")))?;

    // Stable, collision-resistant key. Owner-scoped so cross-tenant access
    // requires explicit grants.
    let owner = sanitize_segment(&user.username);
    let stamp = time::OffsetDateTime::now_utc().unix_timestamp();
    let uuid = Uuid::new_v4().simple();
    let key = format!(
        "owners/{owner}/clients/{cid}/{doc}/{stamp}-{uuid}-{file}",
        owner = if owner.is_empty() { "admin".into() } else { owner },
        cid = sanitize_segment(client_id),
        doc = doc_type,
        stamp = stamp,
        uuid = uuid,
        file = file_name,
    );

    let presigned = presign_put(&cfg, &key, content_type, PRESIGN_TTL_SECS, None)
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    Ok(Json(PresignResponse {
        upload_url: presigned.url,
        key: presigned.key.clone(),
        public_url: public_url(&cfg, &presigned.key),
        expires_at: presigned.expires_at,
        max_size: MAX_UPLOAD_BYTES,
        headers: presigned
            .headers
            .into_iter()
            .map(|(name, value)| HeaderPair { name, value })
            .collect(),
    }))
}

// ─── attach (record uploaded files on a client) ──────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachBody {
    pub documents: Vec<AttachDoc>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AttachDoc {
    pub key: String,
    pub doc_type: String,
    pub file_name: String,
    pub content_type: String,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub include_in_print_letters: Option<bool>,
    #[serde(default)]
    pub print_side: Option<String>,
}

pub async fn attach(
    _user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AttachBody>,
) -> AppResult<Json<Value>> {
    if body.documents.is_empty() {
        return Err(AppError::BadRequest("documents array is required".into()));
    }
    let cfg = R2Config::from_env()
        .ok_or_else(|| AppError::Other(anyhow::anyhow!("R2 not configured")))?;

    let now = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default();

    let mut saved: Vec<Value> = Vec::with_capacity(body.documents.len());
    for doc in &body.documents {
        let key = doc.key.trim();
        if key.is_empty() {
            return Err(AppError::BadRequest("Each document needs a key".into()));
        }
        let record_id = format!("{}_{}", sanitize_segment(&id), Uuid::new_v4().simple());
        state
            .db
            .query(
                "CREATE client_documents SET \
                 id = $id, document_id = $did, client_id = $cid, \
                 doc_type = $type, file_name = $fn, content_type = $ct, \
                 storage_key = $key, public_url = $url, \
                 size_bytes = $sz, include_in_print_letters = $print, print_side = $side, \
                 source_db = 'ninjatools', created_at = $ca",
            )
            .bind(("id", record_id.clone()))
            .bind(("did", record_id.clone()))
            .bind(("cid", id.clone()))
            .bind(("type", doc.doc_type.clone()))
            .bind(("fn", doc.file_name.clone()))
            .bind(("ct", doc.content_type.clone()))
            .bind(("key", key.to_string()))
            .bind(("url", public_url(&cfg, key)))
            .bind(("sz", doc.size.unwrap_or(0).to_string()))
            .bind(("print", doc.include_in_print_letters.unwrap_or(false).to_string()))
            .bind(("side", doc.print_side.clone().unwrap_or_else(|| "front".into())))
            .bind(("ca", now.clone()))
            .await?;
        saved.push(json!({
            "id": record_id,
            "storageKey": key,
            "publicUrl": public_url(&cfg, key),
            "type": doc.doc_type,
            "fileName": doc.file_name,
            "contentType": doc.content_type,
            "size": doc.size,
            "includeInPrintLetters": doc.include_in_print_letters.unwrap_or(false),
            "printSide": doc.print_side.clone().unwrap_or_else(|| "front".into()),
            "createdAt": now,
        }));
    }

    Ok(Json(json!({ "ok": true, "clientId": id, "documents": saved })))
}

// ─── helpers ─────────────────────────────────────────────────────────────

fn normalize_doc_type(t: &str) -> String {
    let clean = t.trim().to_lowercase();
    match clean.as_str() {
        "id" | "id-document" | "iddocument" | "drivers-license" | "driverslicense"
            => "id-document".into(),
        "ssn" | "ssn-document" | "ssncard"
            => "ssn-document".into(),
        "proof-of-address" | "address" | "poa" | "proofofaddress"
            => "proof-of-address".into(),
        "cover-letter" | "coverletter"
            => "cover-letter".into(),
        "" => "other".into(),
        other => sanitize_segment(other),
    }
}

fn sanitize_file_name(name: &str) -> String {
    let trimmed = name.trim();
    let cleaned: String = trimmed
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') { c } else { '_' })
        .collect();
    let cleaned = cleaned.trim_matches('_').to_string();
    if cleaned.is_empty() { "file".into() } else { cleaned }
}

fn sanitize_segment(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '-' | '_') { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

/// Allowlist of content-types we accept for direct upload. Keeps random
/// binaries (executables, scripts) out of the bucket.
fn is_safe_content_type(ct: &str) -> bool {
    matches!(
        ct,
        "image/png"
            | "image/jpeg"
            | "image/jpg"
            | "image/webp"
            | "image/gif"
            | "image/heic"
            | "image/heif"
            | "application/pdf"
            | "text/plain"
            | "text/csv"
            | "application/json"
    )
}
