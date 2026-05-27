use std::sync::Arc;
use std::time::Instant;

use dashmap::DashMap;

use crate::config::Config;

/// Short-lived OAuth state record (CSRF token + replay nonce).
#[derive(Clone, Debug)]
pub struct OauthState {
    pub nonce: String,
    pub created: Instant,
}

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub http: reqwest::Client,
    /// In-flight OAuth `state` values awaiting callback. TTL ~10 min.
    pub oauth_states: Arc<DashMap<String, OauthState>>,
}

impl AppState {
    pub fn new(cfg: Config) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent("ninjadispute-api/0.1")
            .build()?;
        Ok(Self {
            cfg: Arc::new(cfg),
            http,
            oauth_states: Arc::new(DashMap::new()),
        })
    }

    /// Drop OAuth state entries older than 10 minutes.
    pub fn gc_oauth_states(&self) {
        let cutoff = std::time::Duration::from_secs(600);
        self.oauth_states.retain(|_, v| v.created.elapsed() < cutoff);
    }
}
