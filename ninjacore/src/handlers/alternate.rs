//! Alternate dispute letters and creditor contact addresses.
//!
//!   GET    /api/alternate
//!   POST   /api/alternate
//!   PUT    /api/alternate/:id
//!   DELETE /api/alternate/:id
//!
//!   GET    /api/creditor-contacts
//!   POST   /api/creditor-contacts
//!   PUT    /api/creditor-contacts/:id
//!   DELETE /api/creditor-contacts/:id

use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

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

// ── Alternate Letters ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AlternateBody {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub content: String,
    #[serde(rename = "type", default)]
    pub letter_type: String,
}

pub async fn list_alternate(
    user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let mut resp = state
        .db
        .query("SELECT * FROM alternate_letters WHERE owner = $owner ORDER BY createdAt DESC")
        .bind(("owner", user.username.clone()))
        .await?;
    let rows = crate::db::take_many::<Value>(&mut resp, 0)?;
    let out: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id":        rec_key(r),
                "title":     str_field(r, "title"),
                "content":   str_field(r, "content"),
                "type":      str_field(r, "type"),
                "createdAt": str_field(r, "createdAt"),
            })
        })
        .collect();
    Ok(Json(json!({ "alternateLetters": out })))
}

pub async fn create_alternate(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<AlternateBody>,
) -> AppResult<Json<Value>> {
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("title is required".into()));
    }
    let id = Uuid::new_v4().simple().to_string();
    let letter_type = if body.letter_type.trim().is_empty() {
        "general"
    } else {
        body.letter_type.trim()
    };
    state.db
        .query("CREATE type::thing('alternate_letters', $id) SET title = $title, content = $content, type = $type, owner = $owner, createdAt = time::now()")
        .bind(("id",      id.clone()))
        .bind(("title",   body.title.trim().to_string()))
        .bind(("content", body.content.clone()))
        .bind(("type",    letter_type.to_string()))
        .bind(("owner",   user.username.clone()))
        .await?;
    Ok(Json(json!({ "ok": true, "id": id })))
}

pub async fn update_alternate(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AlternateBody>,
) -> AppResult<Json<Value>> {
    let letter_type = if body.letter_type.trim().is_empty() {
        "general"
    } else {
        body.letter_type.trim()
    };
    let mut resp = state.db
        .query("UPDATE type::thing('alternate_letters', $id) SET title = $title, content = $content, type = $type WHERE owner = $owner RETURN AFTER")
        .bind(("id",      id.clone()))
        .bind(("title",   body.title.trim().to_string()))
        .bind(("content", body.content.clone()))
        .bind(("type",    letter_type.to_string()))
        .bind(("owner",   user.username.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_alternate(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let mut resp = state
        .db
        .query("DELETE type::thing('alternate_letters', $id) WHERE owner = $owner RETURN BEFORE")
        .bind(("id", id.clone()))
        .bind(("owner", user.username.clone()))
        .await?;
    let deleted: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deletedId": id })))
}

// ── Creditor Contacts ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreditorBody {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub creditor: String,
    #[serde(default)]
    pub address: String,
    #[serde(default)]
    pub city: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub zip: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub fax: String,
    #[serde(default)]
    pub email: String,
}

pub async fn list_creditors(
    user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    let mut resp = state
        .db
        .query("SELECT * FROM creditor_contacts WHERE owner = $owner ORDER BY createdAt DESC")
        .bind(("owner", user.username.clone()))
        .await?;
    let rows = crate::db::take_many::<Value>(&mut resp, 0)?;
    let out: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id":        rec_key(r),
                "name":      str_field(r, "name"),
                "creditor":  str_field(r, "creditor"),
                "address":   str_field(r, "address"),
                "city":      str_field(r, "city"),
                "state":     str_field(r, "state"),
                "zip":       str_field(r, "zip"),
                "phone":     str_field(r, "phone"),
                "fax":       str_field(r, "fax"),
                "email":     str_field(r, "email"),
                "createdAt": str_field(r, "createdAt"),
            })
        })
        .collect();
    Ok(Json(json!({ "creditorContacts": out })))
}

pub async fn create_creditor(
    user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreditorBody>,
) -> AppResult<Json<Value>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    let id = Uuid::new_v4().simple().to_string();
    state.db
        .query("CREATE type::thing('creditor_contacts', $id) SET name = $name, creditor = $creditor, address = $address, city = $city, state = $state, zip = $zip, phone = $phone, fax = $fax, email = $email, owner = $owner, createdAt = time::now()")
        .bind(("id",       id.clone()))
        .bind(("name",     body.name.trim().to_string()))
        .bind(("creditor", body.creditor.trim().to_string()))
        .bind(("address",  body.address.trim().to_string()))
        .bind(("city",     body.city.trim().to_string()))
        .bind(("state",    body.state.trim().to_string()))
        .bind(("zip",      body.zip.trim().to_string()))
        .bind(("phone",    body.phone.trim().to_string()))
        .bind(("fax",      body.fax.trim().to_string()))
        .bind(("email",    body.email.trim().to_string()))
        .bind(("owner",    user.username.clone()))
        .await?;
    Ok(Json(json!({ "ok": true, "id": id })))
}

pub async fn update_creditor(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<CreditorBody>,
) -> AppResult<Json<Value>> {
    let mut resp = state.db
        .query("UPDATE type::thing('creditor_contacts', $id) SET name = $name, creditor = $creditor, address = $address, city = $city, state = $state, zip = $zip, phone = $phone, fax = $fax, email = $email WHERE owner = $owner RETURN AFTER")
        .bind(("id",       id.clone()))
        .bind(("name",     body.name.trim().to_string()))
        .bind(("creditor", body.creditor.trim().to_string()))
        .bind(("address",  body.address.trim().to_string()))
        .bind(("city",     body.city.trim().to_string()))
        .bind(("state",    body.state.trim().to_string()))
        .bind(("zip",      body.zip.trim().to_string()))
        .bind(("phone",    body.phone.trim().to_string()))
        .bind(("fax",      body.fax.trim().to_string()))
        .bind(("email",    body.email.trim().to_string()))
        .bind(("owner",    user.username.clone()))
        .await?;
    let updated: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    updated.ok_or(AppError::NotFound)?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_creditor(
    user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let mut resp = state
        .db
        .query("DELETE type::thing('creditor_contacts', $id) WHERE owner = $owner RETURN BEFORE")
        .bind(("id", id.clone()))
        .bind(("owner", user.username.clone()))
        .await?;
    let deleted: Option<Value> = crate::db::take_one(&mut resp, 0)?;
    if deleted.is_none() {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "ok": true, "deletedId": id })))
}
