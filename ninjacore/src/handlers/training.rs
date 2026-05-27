//! Training group.
//!
//!   GET  /api/training/clients
//!   GET  /api/training/context/session
//!   POST /api/training/context/session
//!   GET  /api/training/context/public/:context_id?token=
//!   POST /api/training/ai/rewrite              (groq | claude)
//!   GET  /api/training/clients/:id/derogatory  (STUB — credit-report parsing)

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Json;
use dashmap::DashMap;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const OWNER: &str = "admin";

#[derive(Clone, Debug)]
struct LearningContextRow {
    context: Value,
    updated_at: String,
    context_id: String,
    access_token: String,
    context_public_url: String,
}

static LEARNING_CTX: Lazy<Arc<DashMap<String, LearningContextRow>>> =
    Lazy::new(|| Arc::new(DashMap::new()));

// ─── /api/training/clients ────────────────────────────────────────────────

#[derive(Serialize)]
pub struct TrainingClient {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub dob: String,
    pub ssn: String,
    pub address: String,
    pub documents: Vec<Value>,
    pub monitoring_agency: String,
    pub report_date: String,
    pub has_json_report: bool,
}

pub async fn list_clients(
    _user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    #[derive(Deserialize)]
    struct Row {
        id: String,
        #[serde(default)] first_name: String,
        #[serde(default)] last_name: String,
        #[serde(default)] email: String,
        #[serde(default)] dob: String,
        #[serde(default)] ssn: String,
        #[serde(default)] address: String,
        #[serde(default)] documents: Vec<Value>,
        #[serde(default)] monitoring_agency: String,
        #[serde(default)] report_date: String,
        #[serde(default)] credit_report_json: String,
        #[serde(default)] credit_report_html: String,
    }
    let mut __resp = state
        .db
        .query("SELECT id, first_name, last_name, email, dob, ssn, address, documents, monitoring_agency, report_date, credit_report_json, credit_report_html FROM clients")
        .await?;
    let rows: Vec<Row> = crate::db::take_many(&mut __resp, 0)?;

    let clients: Vec<TrainingClient> = rows
        .into_iter()
        .map(|r| {
            let has_json = !r.credit_report_json.trim().is_empty()
                || !r.credit_report_html.trim().is_empty();
            TrainingClient {
                id: r.id,
                first_name: r.first_name.trim().into(),
                last_name: r.last_name.trim().into(),
                email: r.email.trim().into(),
                dob: r.dob.trim().into(),
                ssn: r.ssn.trim().into(),
                address: r.address.trim().into(),
                documents: r.documents,
                monitoring_agency: r.monitoring_agency.trim().into(),
                report_date: r.report_date.trim().into(),
                has_json_report: has_json,
            }
        })
        .collect();
    Ok(Json(json!({ "ok": true, "clients": clients })))
}

// ─── /api/training/context/session ────────────────────────────────────────

pub async fn get_session(_user: AuthUser) -> Json<Value> {
    let row = LEARNING_CTX.get(OWNER).map(|r| r.clone());
    Json(json!({
        "ok": true,
        "ownerKey": OWNER,
        "context": row.as_ref().map(|r| r.context.clone()),
        "updatedAt": row.as_ref().map(|r| r.updated_at.clone()),
        "contextId": row.as_ref().map(|r| r.context_id.clone()).unwrap_or_default(),
        "contextPublicUrl": row.as_ref().map(|r| r.context_public_url.clone()).unwrap_or_default(),
    }))
}

#[derive(Deserialize)]
pub struct SessionBody {
    pub context: Option<Value>,
    #[serde(default, rename = "pushToGhl")]
    pub _push_to_ghl: bool,
}

pub async fn post_session(
    _user: AuthUser,
    headers: HeaderMap,
    Json(body): Json<SessionBody>,
) -> AppResult<Json<Value>> {
    let ctx = body.context.ok_or_else(|| AppError::BadRequest("context payload is required.".into()))?;
    let serialized = serde_json::to_string(&ctx).map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    if serialized.len() > 2_500_000 {
        return Err(AppError::BadRequest("Context payload is too large.".into()));
    }
    let updated_at = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;

    let (context_id, access_token) = match LEARNING_CTX.get(OWNER) {
        Some(r) => (r.context_id.clone(), r.access_token.clone()),
        None => (
            Uuid::new_v4().to_string(),
            format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        ),
    };

    let proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "https".into());
    let host = headers
        .get("x-forwarded-host")
        .or_else(|| headers.get(axum::http::header::HOST))
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    let context_public_url = if host.is_empty() {
        String::new()
    } else {
        format!(
            "{proto}://{host}/api/training/context/public/{}?token={}",
            urlencode(&context_id),
            urlencode(&access_token),
        )
    };

    LEARNING_CTX.insert(
        OWNER.into(),
        LearningContextRow {
            context: ctx,
            updated_at: updated_at.clone(),
            context_id: context_id.clone(),
            access_token,
            context_public_url: context_public_url.clone(),
        },
    );

    Ok(Json(json!({
        "ok": true,
        "ownerKey": OWNER,
        "updatedAt": updated_at,
        "bytes": serialized.len(),
        "contextId": context_id,
        "contextPublicUrl": context_public_url,
        "goHighLevelSync": Value::Null,
    })))
}

#[derive(Deserialize)]
pub struct PublicQuery {
    #[serde(default)]
    pub token: Option<String>,
}

pub async fn get_public_context(
    Path(context_id): Path<String>,
    Query(q): Query<PublicQuery>,
) -> AppResult<Json<Value>> {
    let token = q.token.unwrap_or_default();
    let found = LEARNING_CTX
        .iter()
        .find(|e| e.context_id == context_id && e.access_token == token)
        .map(|e| e.clone());
    let row = found.ok_or(AppError::Unauthorized)?;
    Ok(Json(json!({
        "ok": true,
        "contextId": row.context_id,
        "updatedAt": row.updated_at,
        "context": row.context,
    })))
}

// ─── /api/training/ai/rewrite ─────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RewriteBody {
    #[serde(default)] pub provider: Option<String>,
    #[serde(default)] pub level: Option<String>,
    #[serde(default, rename = "selectedText")] pub selected_text: Option<String>,
    #[serde(default, rename = "customPrompt")] pub custom_prompt: Option<String>,
    #[serde(default)] pub context: Option<Value>,
}

pub async fn ai_rewrite(
    _user: AuthUser,
    Json(body): Json<RewriteBody>,
) -> AppResult<Json<Value>> {
    let provider = body.provider.unwrap_or_else(|| "groq".into()).trim().to_lowercase();
    let level = body.level.unwrap_or_else(|| "Initial Letter".into());
    let selected_text = body.selected_text.unwrap_or_default().trim().to_string();
    let custom = body.custom_prompt.unwrap_or_default();

    if selected_text.len() < 10 {
        return Err(AppError::BadRequest("Please select at least 10 characters to rewrite.".into()));
    }

    let prompt = build_rewrite_prompt(&level, &selected_text, body.context.as_ref(), &custom);
    let rewritten = match provider.as_str() {
        "groq" => call_groq(&prompt).await?,
        "claude" | "anthropic" => call_anthropic(&prompt).await?,
        other => return Err(AppError::BadRequest(format!(
            "Unsupported provider \"{other}\". Use groq or claude."
        ))),
    };
    Ok(Json(json!({
        "ok": true,
        "provider": provider,
        "level": level,
        "text": rewritten,
    })))
}

fn build_rewrite_prompt(level: &str, selected: &str, ctx: Option<&Value>, custom: &str) -> String {
    let mut p = String::new();
    p.push_str(&format!("Letter level: {level}\n\n"));
    if let Some(c) = ctx {
        if let Ok(s) = serde_json::to_string_pretty(c) {
            p.push_str("Context:\n");
            p.push_str(&s);
            p.push_str("\n\n");
        }
    }
    if !custom.trim().is_empty() {
        p.push_str("User instructions:\n");
        p.push_str(custom.trim());
        p.push_str("\n\n");
    }
    p.push_str("Rewrite the following selection in the same voice and length, sharper and clearer:\n");
    p.push_str(selected);
    p
}

async fn call_groq(prompt: &str) -> AppResult<String> {
    let key = std::env::var("GROQ_API_KEY")
        .map_err(|_| AppError::BadRequest("GROQ_API_KEY not configured on server.".into()))?;
    let client = crate::http::shared();
    let model = std::env::var("GROQ_MODEL").unwrap_or_else(|_| "llama-3.3-70b-versatile".into());
    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(key)
        .json(&json!({
            "model": model,
            "messages": [{"role":"user","content": prompt}],
            "temperature": 0.4,
        }))
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let v: Value = resp.json().await.map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    Ok(v["choices"][0]["message"]["content"].as_str().unwrap_or("").trim().to_string())
}

async fn call_anthropic(prompt: &str) -> AppResult<String> {
    let key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| AppError::BadRequest("ANTHROPIC_API_KEY not configured on server.".into()))?;
    let model = std::env::var("ANTHROPIC_MODEL").unwrap_or_else(|_| "claude-sonnet-4-6".into());
    let client = crate::http::shared();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role":"user","content": prompt}],
        }))
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let v: Value = resp.json().await.map_err(|e| AppError::Other(anyhow::anyhow!(e)))?;
    let text = v["content"]
        .as_array()
        .and_then(|arr| arr.iter().find(|b| b["type"] == "text"))
        .and_then(|b| b["text"].as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    Ok(text)
}

// ─── helpers ──────────────────────────────────────────────────────────────

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
