use std::str::FromStr;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use rand_core::OsRng;
use rusty_paseto::core::{Footer, Key, Local, Paseto, PasetoNonce, Payload, V4};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;
use crate::state::{AppState, SessionEntry};

const COOKIE_NAME: &str = "txn";

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub sub: String,
    pub iat: i64,
    pub exp: i64,
}

/// Matches the live `users` table scheme: `sha256(salt || password)` where
/// salt is `"seed:<username>"`. The salt is stored alongside the hash so we
/// can recompute on verify.
pub fn hash_password_with_salt(salt: &str, password: &str) -> String {
    let mut h = Sha256::new();
    h.update(salt.as_bytes());
    h.update(password.as_bytes());
    let digest = h.finalize();
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn default_salt(username: &str) -> String {
    format!("seed:{}", username)
}

pub fn verify_password(password: &str, salt: &str, expected_hex: &str) -> bool {
    let actual = hash_password_with_salt(salt, password);
    // Constant-time compare.
    if actual.len() != expected_hex.len() {
        return false;
    }
    let mut diff = 0u8;
    for (a, b) in actual.bytes().zip(expected_hex.bytes()) {
        diff |= a ^ b;
    }
    diff == 0
}

/// Issue a Paseto v4.local token carrying the username + expiry.
/// Also seeds the in-process DashMap session cache so subsequent requests
/// validate in O(1) without re-decrypting.
pub fn issue_token(state: &AppState, username: &str, ttl_secs: i64) -> anyhow::Result<String> {
    let now = time::OffsetDateTime::now_utc();
    let exp = now + time::Duration::seconds(ttl_secs);
    let claims = TokenClaims {
        sub: username.to_string(),
        iat: now.unix_timestamp(),
        exp: exp.unix_timestamp(),
    };
    let json = serde_json::to_string(&claims)?;

    let mut nonce_bytes = [0u8; 32];
    use rand_core::RngCore;
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce_key = Key::<32>::from(nonce_bytes);
    let nonce = PasetoNonce::<V4, Local>::from(&nonce_key);

    let token = Paseto::<V4, Local>::builder()
        .set_payload(Payload::from(json.as_str()))
        .try_encrypt(&state.paseto_key, &nonce)
        .map_err(|e| anyhow::anyhow!("paseto encrypt: {e}"))?;

    state.sessions.insert(
        token.clone(),
        SessionEntry {
            username: username.to_string(),
            issued_at: now,
        },
    );
    Ok(token)
}

pub fn build_cookie(token: &str, ttl_secs: i64) -> String {
    let c = cookie::Cookie::build((COOKIE_NAME, token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(cookie::SameSite::Lax)
        .max_age(cookie::time::Duration::seconds(ttl_secs))
        .build();
    c.to_string()
}

pub fn clear_cookie() -> String {
    let c = cookie::Cookie::build((COOKIE_NAME, ""))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(cookie::SameSite::Lax)
        .max_age(cookie::time::Duration::ZERO)
        .build();
    c.to_string()
}

fn read_cookie_token(parts: &Parts) -> Option<String> {
    let header = parts
        .headers
        .get(axum::http::header::COOKIE)?
        .to_str()
        .ok()?;
    for piece in header.split(';') {
        let piece = piece.trim();
        if let Some(rest) = piece.strip_prefix(&format!("{COOKIE_NAME}=")) {
            return Some(rest.to_string());
        }
    }
    None
}

/// Authenticated user extractor.
/// Looks up the token in the DashMap cache first; falls back to Paseto decrypt.
pub struct AuthUser {
    pub username: String,
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = read_cookie_token(parts).ok_or(AppError::Unauthorized)?;

        if let Some(entry) = state.sessions.get(&token) {
            return Ok(AuthUser {
                username: entry.username.clone(),
            });
        }

        let decrypted =
            Paseto::<V4, Local>::try_decrypt(&token, &state.paseto_key, None::<Footer>, None)
                .map_err(|_| AppError::Unauthorized)?;

        let claims: TokenClaims =
            serde_json::from_str(&decrypted).map_err(|_| AppError::Unauthorized)?;
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        if claims.exp < now {
            return Err(AppError::Unauthorized);
        }
        state.sessions.insert(
            token,
            SessionEntry {
                username: claims.sub.clone(),
                issued_at: time::OffsetDateTime::from_unix_timestamp(claims.iat)
                    .unwrap_or_else(|_| time::OffsetDateTime::now_utc()),
            },
        );
        Ok(AuthUser {
            username: claims.sub,
        })
    }
}

// Silence unused import in case `FromStr` is dropped later.
#[allow(dead_code)]
fn _keep_fromstr<T: FromStr>() {}
