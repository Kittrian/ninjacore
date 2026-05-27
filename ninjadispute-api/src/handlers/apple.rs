//! Sign in with Apple — OAuth 2.0 authorization-code flow with `form_post`.
//!
//! Flow:
//!   1. GET  /auth/apple              → 302 → https://appleid.apple.com/auth/authorize
//!   2. POST /auth/apple/callback     ← Apple form-posts {code,state,id_token,user?}
//!      - verify CSRF state, exchange code for tokens, verify id_token via JWKS,
//!        upsert user (TODO when persistence lands), redirect to frontend.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use axum::{
    extract::{Form, State},
    response::{IntoResponse, Redirect},
};
use jsonwebtoken::{decode, decode_header, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use once_cell::sync::Lazy;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::state::{AppState, OauthState};

const APPLE_AUTHORIZE_URL: &str = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL: &str = "https://appleid.apple.com/auth/token";
const APPLE_JWKS_URL: &str = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER: &str = "https://appleid.apple.com";

// ---------------------------------------------------------------------------
// GET /auth/apple — kick off the redirect
// ---------------------------------------------------------------------------

pub async fn start(State(state): State<AppState>) -> impl IntoResponse {
    state.gc_oauth_states();

    let oauth_state = rand_token(24);
    let nonce = rand_token(24);
    state.oauth_states.insert(
        oauth_state.clone(),
        OauthState { nonce: nonce.clone(), created: Instant::now() },
    );

    let cfg = &state.cfg.apple;
    let params = [
        ("response_type", "code"),
        ("response_mode", "form_post"),
        ("client_id", cfg.services_id.as_str()),
        ("redirect_uri", cfg.redirect_uri.as_str()),
        ("scope", "name email"),
        ("state", oauth_state.as_str()),
        ("nonce", nonce.as_str()),
    ];
    let qs = serde_urlencoded::to_string(params).unwrap_or_default();
    Redirect::to(&format!("{APPLE_AUTHORIZE_URL}?{qs}"))
}

// ---------------------------------------------------------------------------
// POST /auth/apple/callback — form-post from Apple
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CallbackForm {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub id_token: Option<String>,
    /// Apple sends `user` JSON only on the very first authorization.
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

pub async fn callback(
    State(state): State<AppState>,
    Form(form): Form<CallbackForm>,
) -> impl IntoResponse {
    if let Some(err) = form.error.as_deref() {
        tracing::warn!(error = %err, "apple callback: provider error");
        return Redirect::to(&state.cfg.frontend_failure_url).into_response();
    }

    let Some(code) = form.code.as_deref() else {
        return Redirect::to(&state.cfg.frontend_failure_url).into_response();
    };
    let Some(state_token) = form.state.as_deref() else {
        return Redirect::to(&state.cfg.frontend_failure_url).into_response();
    };

    // CSRF: state must match one we issued (single-use).
    let Some((_, oauth_state)) = state.oauth_states.remove(state_token) else {
        tracing::warn!("apple callback: unknown state token");
        return Redirect::to(&state.cfg.frontend_failure_url).into_response();
    };
    if oauth_state.created.elapsed() > std::time::Duration::from_secs(600) {
        return Redirect::to(&state.cfg.frontend_failure_url).into_response();
    }

    // 2a. Build a fresh client_secret JWT (cached per-process for ~150 days).
    let client_secret = match cached_client_secret(&state).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "apple: build client_secret failed");
            return Redirect::to(&state.cfg.frontend_failure_url).into_response();
        }
    };

    // 2b. Exchange code → tokens.
    let token_resp = match exchange_code(&state, code, &client_secret).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "apple: token exchange failed");
            return Redirect::to(&state.cfg.frontend_failure_url).into_response();
        }
    };

    // 2c. Verify id_token against Apple's JWKS.
    let claims = match verify_id_token(&state, &token_resp.id_token, &oauth_state.nonce).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, "apple: id_token verification failed");
            return Redirect::to(&state.cfg.frontend_failure_url).into_response();
        }
    };

    tracing::info!(sub = %claims.sub, email = ?claims.email, "apple: sign-in verified");

    // TODO: upsert SurrealDB user, issue local session cookie, then redirect.
    Redirect::to(&state.cfg.frontend_success_url).into_response()
}

// ---------------------------------------------------------------------------
// client_secret JWT (ES256, Apple-flavored)
// ---------------------------------------------------------------------------

/// `(client_secret_jwt, generated_at_unix)`
static CLIENT_SECRET_CACHE: Lazy<Mutex<Option<(String, u64)>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Serialize)]
struct ClientSecretClaims<'a> {
    iss: &'a str,
    iat: u64,
    exp: u64,
    aud: &'a str,
    sub: &'a str,
}

async fn cached_client_secret(state: &AppState) -> anyhow::Result<String> {
    let mut guard = CLIENT_SECRET_CACHE.lock().await;
    let now = unix_now();
    if let Some((tok, gen_at)) = guard.as_ref() {
        // Regenerate when within 5 days of expiry (we set 150d TTL).
        if now < gen_at + 150 * 86_400 - 5 * 86_400 {
            return Ok(tok.clone());
        }
    }

    let cfg = &state.cfg.apple;
    let exp = now + 150 * 86_400; // Apple max is 180d
    let claims = ClientSecretClaims {
        iss: &cfg.team_id,
        iat: now,
        exp,
        aud: APPLE_ISSUER,
        sub: &cfg.services_id,
    };
    let mut header = Header::new(Algorithm::ES256);
    header.kid = Some(cfg.key_id.clone());
    let key = EncodingKey::from_ec_pem(cfg.private_key_pem.as_bytes())
        .map_err(|e| anyhow::anyhow!("apple: invalid .p8 private key: {e}"))?;
    let token = encode(&header, &claims, &key)?;

    *guard = Some((token.clone(), now));
    Ok(token)
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenResponse {
    #[allow(dead_code)]
    access_token: String,
    id_token: String,
    #[allow(dead_code)]
    #[serde(default)]
    refresh_token: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    expires_in: Option<i64>,
    #[allow(dead_code)]
    #[serde(default)]
    token_type: Option<String>,
}

async fn exchange_code(state: &AppState, code: &str, client_secret: &str) -> anyhow::Result<TokenResponse> {
    let cfg = &state.cfg.apple;
    let form: [(&str, &str); 5] = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", cfg.services_id.as_str()),
        ("client_secret", client_secret),
        ("redirect_uri", cfg.redirect_uri.as_str()),
    ];
    let resp = state
        .http
        .post(APPLE_TOKEN_URL)
        .form(&form)
        .send()
        .await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("apple token endpoint {status}: {body}");
    }
    Ok(resp.json::<TokenResponse>().await?)
}

// ---------------------------------------------------------------------------
// id_token verification against Apple JWKS
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AppleIdClaims {
    pub sub: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: Option<serde_json::Value>,
    #[serde(default)]
    pub is_private_email: Option<serde_json::Value>,
    pub nonce: Option<String>,
    pub aud: String,
    pub iss: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, Deserialize)]
struct JwksDoc {
    keys: Vec<JwkKey>,
}

#[derive(Debug, Deserialize, Clone)]
struct JwkKey {
    kid: String,
    n: String,
    e: String,
    alg: Option<String>,
    kty: String,
    #[serde(rename = "use")]
    use_: Option<String>,
}

static JWKS_CACHE: Lazy<Mutex<Option<(HashMap<String, JwkKey>, Instant)>>> =
    Lazy::new(|| Mutex::new(None));

async fn jwks(state: &AppState) -> anyhow::Result<HashMap<String, JwkKey>> {
    {
        let guard = JWKS_CACHE.lock().await;
        if let Some((keys, fetched)) = guard.as_ref() {
            if fetched.elapsed() < std::time::Duration::from_secs(3600) {
                return Ok(keys.clone());
            }
        }
    }
    let doc: JwksDoc = state.http.get(APPLE_JWKS_URL).send().await?.json().await?;
    let map: HashMap<String, JwkKey> =
        doc.keys.into_iter().map(|k| (k.kid.clone(), k)).collect();
    *JWKS_CACHE.lock().await = Some((map.clone(), Instant::now()));
    Ok(map)
}

async fn verify_id_token(
    state: &AppState,
    id_token: &str,
    expected_nonce: &str,
) -> anyhow::Result<AppleIdClaims> {
    let header = decode_header(id_token)?;
    let kid = header.kid.ok_or_else(|| anyhow::anyhow!("id_token missing kid"))?;
    let mut keys = jwks(state).await?;
    let key = match keys.remove(&kid) {
        Some(k) => k,
        None => {
            // Force-refresh once; Apple may have rotated.
            *JWKS_CACHE.lock().await = None;
            jwks(state)
                .await?
                .remove(&kid)
                .ok_or_else(|| anyhow::anyhow!("apple JWKS missing kid {kid}"))?
        }
    };

    if key.kty != "RSA" {
        anyhow::bail!("apple JWKS unexpected kty {}", key.kty);
    }
    if let Some(use_) = &key.use_ {
        if use_ != "sig" {
            anyhow::bail!("apple JWKS key not for sig");
        }
    }
    let alg = match key.alg.as_deref() {
        Some("RS256") | None => Algorithm::RS256,
        Some(other) => anyhow::bail!("apple JWKS unexpected alg {other}"),
    };

    let decoding = DecodingKey::from_rsa_components(&key.n, &key.e)?;
    let mut validation = Validation::new(alg);
    validation.set_issuer(&[APPLE_ISSUER]);
    validation.set_audience(&[state.cfg.apple.services_id.as_str()]);
    validation.validate_exp = true;

    let data = decode::<AppleIdClaims>(id_token, &decoding, &validation)?;
    let claims = data.claims;

    // Bind to the nonce we issued in the auth request.
    match claims.nonce.as_deref() {
        Some(n) if n == expected_nonce => {}
        _ => anyhow::bail!("apple id_token nonce mismatch"),
    }

    Ok(claims)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn rand_token(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

fn unix_now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

// Keep clippy quiet about the Arc import path while we're not using it yet.
#[allow(dead_code)]
fn _hint(_: Arc<AppState>) {}
