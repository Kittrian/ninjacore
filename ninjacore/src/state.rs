use std::sync::Arc;

use bytes::Bytes;
use dashmap::DashMap;
use rusty_paseto::core::{Key, Local, PasetoSymmetricKey, V4};

use crate::config::Config;
use crate::db::Db;
use crate::report_run::ReportRunStore;

/// Cached session record (by Paseto token id).
#[derive(Clone, Debug)]
pub struct SessionEntry {
    pub username: String,
    pub issued_at: time::OffsetDateTime,
}

/// Shared application state injected into every handler via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub db: Db,
    /// Hot session cache — Paseto auth path stays in-process, never hits SurrealDB.
    pub sessions: Arc<DashMap<String, SessionEntry>>,
    /// Pre-rendered letter chunks (binary), keyed by chunk id.
    /// Letter generation reads these with zero copies via `Bytes`.
    pub chunks: Arc<DashMap<String, Bytes>>,
    pub paseto_key: Arc<PasetoSymmetricKey<V4, Local>>,
    /// In-memory store of in-flight / recently-completed browser report runs.
    pub report_runs: ReportRunStore,
    /// Process-wide HTTP client with a warm connection pool + HTTP/2 ALPN.
    /// Reused for R2 / Cloudflare Worker fetches and any other outbound calls
    /// so we keep TCP+TLS sessions open across requests.
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(cfg: Config, db: Db) -> anyhow::Result<Self> {
        let key_bytes = hex_decode_32(&cfg.paseto_key_hex)?;
        let paseto_key = PasetoSymmetricKey::<V4, Local>::from(Key::from(key_bytes));
        let http = crate::http::shared();
        Ok(Self {
            cfg: Arc::new(cfg),
            db,
            sessions: Arc::new(DashMap::new()),
            chunks: Arc::new(DashMap::new()),
            paseto_key: Arc::new(paseto_key),
            report_runs: Arc::new(DashMap::new()),
            http,
        })
    }
}

fn hex_decode_32(s: &str) -> anyhow::Result<[u8; 32]> {
    anyhow::ensure!(s.len() == 64, "PASETO_KEY must be 64 hex chars (32 bytes)");
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16)
            .map_err(|_| anyhow::anyhow!("PASETO_KEY: invalid hex"))?;
    }
    Ok(out)
}
