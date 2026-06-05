//! Letter templates and reusable paragraphs.
//!
//!   GET    /api/templates
//!   POST   /api/templates
//!   PUT    /api/templates/:id
//!   DELETE /api/templates/:id
//!
//!   GET    /api/paragraphs
//!   POST   /api/paragraphs
//!   PUT    /api/paragraphs/:id
//!   DELETE /api/paragraphs/:id

use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Extract the record key portion from a SurrealDB ID string like `templates:abc123`.
fn rec_key(v: &Value) -> String {
    v.get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split(':')
        .nth(1)
        .unwrap_or("")
        .to_string()
}

fn str_field<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}

// ── Letter Templates ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct TemplateBody {
    #[serde(default)] pub title: String,
    #[serde(default)] pub content: String,
    #[serde(rename = "type", default)] pub tpl_type: String,
}

pub async fn list_templates(
    user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let mut resp = state.db
        .query("SELECT * FROM templates WHERE owner = $owner ORDER BY createdAt DESC")
        .bind(("owner", user.username.clone()))
        .await?;
    let rows = crate::db::take_many::<Value>(&mut resp, 0)?;
    let out: Vec<Value> = rows.iter().map(|r| json!({
        "id":        rec_key(r),
        "title":     str_field(r, "title"),
        "content":   str_field(r, "content"),
        "type":      str_field(r, "type"),
        "createdAt": str_field(r, "createdAt"),
    })).collect();
    Ok(Json(json!({ "templates": out })))
}

pub async fn create_template(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<TemplateBody>,
) -> AppResult<Json<Value>> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let id = Uuid::new_v4().simple().to_string();
    let tpl_type = if body.tpl_type.trim().is_empty() { "all" } else { body.tpl_type.trim() };
    state.db
        .query("CREATE type::record('templates', $id) SET title = $title, content = $content, type = $type, owner = $owner, createdAt = time::now()")
        .bind(("id",      id.clone()))
        .bind(("title",   body.title.trim().to_string()))
        .bind(("content", body.content.clone()))
        .bind(("type",    tpl_type.to_string()))
        .bind(("owner",   user.username.clone()))
        .await?;
    Ok(Json(json!({ "ok": true, "id": id })))
}

pub async fn update_template(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<TemplateBody>,
) -> AppResult<Json<Value>> {
    let tpl_type = if body.tpl_type.trim().is_empty() { "all" } else { body.tpl_type.trim() };
    let mut resp = state.db
        .query("UPDATE type::record('templates', $id) SET title = $title, content = $content, type = $type WHERE owner = $owner RETURN AFTER")
        .bind(("id",      id.clone()))
        .bind(("title",   body.title.trim().to_string()))
        .bind(("content", body.content.clone()))
        .bind(("type",    tpl_type.to_string()))
        .bind(("owner",   user.username.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_template(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let mut resp = state.db
        .query("DELETE type::record('templates', $id) WHERE owner = $owner RETURN BEFORE")
        .bind(("id",    id.clone()))
        .bind(("owner", user.username.clone()))
        .await?;
    let deleted: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deletedId": id })))
}

// ── Reusable Paragraphs ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ParagraphBody {
    #[serde(default)] pub title: String,
    #[serde(default)] pub content: String,
    #[serde(default)] pub category: String,
}

pub async fn list_paragraphs(
    user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let mut resp = state.db
        .query("SELECT * FROM paragraphs WHERE owner = $owner ORDER BY createdAt DESC")
        .bind(("owner", user.username.clone()))
        .await?;
    let rows = crate::db::take_many::<Value>(&mut resp, 0)?;
    let out: Vec<Value> = rows.iter().map(|r| json!({
        "id":        rec_key(r),
        "title":     str_field(r, "title"),
        "content":   str_field(r, "content"),
        "category":  str_field(r, "category"),
        "createdAt": str_field(r, "createdAt"),
    })).collect();
    Ok(Json(json!({ "paragraphs": out })))
}

pub async fn create_paragraph(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ParagraphBody>,
) -> AppResult<Json<Value>> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let id = Uuid::new_v4().simple().to_string();
    state.db
        .query("CREATE type::record('paragraphs', $id) SET title = $title, content = $content, category = $category, owner = $owner, createdAt = time::now()")
        .bind(("id",       id.clone()))
        .bind(("title",    body.title.trim().to_string()))
        .bind(("content",  body.content.clone()))
        .bind(("category", body.category.trim().to_string()))
        .bind(("owner",    user.username.clone()))
        .await?;
    Ok(Json(json!({ "ok": true, "id": id })))
}

pub async fn update_paragraph(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<ParagraphBody>,
) -> AppResult<Json<Value>> {
    let mut resp = state.db
        .query("UPDATE type::record('paragraphs', $id) SET title = $title, content = $content, category = $category WHERE owner = $owner RETURN AFTER")
        .bind(("id",       id.clone()))
        .bind(("title",    body.title.trim().to_string()))
        .bind(("content",  body.content.clone()))
        .bind(("category", body.category.trim().to_string()))
        .bind(("owner",    user.username.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_paragraph(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let mut resp = state.db
        .query("DELETE type::record('paragraphs', $id) WHERE owner = $owner RETURN BEFORE")
        .bind(("id",    id.clone()))
        .bind(("owner", user.username.clone()))
        .await?;
    let deleted: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deletedId": id })))
}
