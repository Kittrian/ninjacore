use anyhow::{Context, Result};
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: String,
    pub public_base_url: String,
    pub apple: AppleConfig,
    pub frontend_success_url: String,
    pub frontend_failure_url: String,
}

#[derive(Clone, Debug)]
pub struct AppleConfig {
    pub team_id: String,
    pub services_id: String,
    pub key_id: String,
    pub private_key_pem: String,
    pub redirect_uri: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let _ = dotenvy::dotenv();
        let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8090".into());
        let public_base_url = env::var("PUBLIC_BASE_URL")
            .unwrap_or_else(|_| "https://api.ninjadispute.com".into());

        let apple = AppleConfig::from_env(&public_base_url)?;

        Ok(Self {
            bind_addr,
            public_base_url,
            apple,
            frontend_success_url: env::var("FRONTEND_SUCCESS_URL")
                .unwrap_or_else(|_| "https://ninjadispute.com/dashboard".into()),
            frontend_failure_url: env::var("FRONTEND_FAILURE_URL")
                .unwrap_or_else(|_| "https://ninjadispute.com/login?error=apple".into()),
        })
    }
}

impl AppleConfig {
    fn from_env(public_base_url: &str) -> Result<Self> {
        let team_id = env::var("APPLE_TEAM_ID").context("APPLE_TEAM_ID not set")?;
        let services_id = env::var("APPLE_SERVICES_ID").context("APPLE_SERVICES_ID not set")?;
        let key_id = env::var("APPLE_KEY_ID").context("APPLE_KEY_ID not set")?;

        let private_key_pem = match env::var("APPLE_PRIVATE_KEY_PEM") {
            Ok(pem) if !pem.trim().is_empty() => pem,
            _ => {
                let path = env::var("APPLE_PRIVATE_KEY_PATH")
                    .context("APPLE_PRIVATE_KEY_PEM or APPLE_PRIVATE_KEY_PATH must be set")?;
                std::fs::read_to_string(&path)
                    .with_context(|| format!("reading Apple .p8 at {path}"))?
            }
        };

        let redirect_uri = env::var("APPLE_REDIRECT_URI")
            .unwrap_or_else(|_| format!("{}/auth/apple/callback", public_base_url.trim_end_matches('/')));

        Ok(Self { team_id, services_id, key_id, private_key_pem, redirect_uri })
    }
}
