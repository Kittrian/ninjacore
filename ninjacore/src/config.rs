use anyhow::{Context, Result};
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: String,
    pub surreal_url: String,
    pub surreal_ns: String,
    pub surreal_db: String,
    pub surreal_user: String,
    pub surreal_pass: String,
    pub paseto_key_hex: String,
    /// Path to the Node browser-runner script (XxXGetReport-NinjaTools.mjs).
    pub report_script_path: String,
    /// Working directory used when spawning the report script.
    pub report_script_cwd: String,
    /// `node` (or compatible) binary used to execute the report script.
    pub node_bin: String,
    /// Base URL the report script uses to call back into this API.
    pub tools_ninja_api_base: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let _ = dotenvy::dotenv();
        let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into());
        let api_base_default = api_base_from_bind_addr(&bind_addr);
        Ok(Self {
            bind_addr,
            surreal_url: env::var("SURREAL_URL").context("SURREAL_URL not set")?,
            surreal_ns: env::var("SURREAL_NS").unwrap_or_else(|_| "ninjadispute".into()),
            surreal_db: env::var("SURREAL_DB").unwrap_or_else(|_| "main".into()),
            surreal_user: env::var("SURREAL_USER").context("SURREAL_USER not set")?,
            surreal_pass: env::var("SURREAL_PASS").context("SURREAL_PASS not set")?,
            paseto_key_hex: env::var("PASETO_KEY").context("PASETO_KEY not set (64 hex chars)")?,
            report_script_path: env::var("REPORT_SCRIPT_PATH")
                .unwrap_or_else(|_| "../scripts/XxXGetReport-NinjaTools.mjs".into()),
            report_script_cwd: env::var("REPORT_SCRIPT_CWD").unwrap_or_else(|_| "..".into()),
            node_bin: env::var("NODE_BIN").unwrap_or_else(|_| "node".into()),
            tools_ninja_api_base: env::var("TOOLS_NINJA_API_BASE").unwrap_or(api_base_default),
        })
    }
}

fn api_base_from_bind_addr(bind: &str) -> String {
    // BIND_ADDR is e.g. "0.0.0.0:8080" — the script runs on the same host, so
    // rewrite the unspecified address to loopback and prefix scheme.
    let host_port = bind.trim();
    let (host, port) = host_port.rsplit_once(':').unwrap_or(("127.0.0.1", "8080"));
    let host = if host.is_empty() || host == "0.0.0.0" || host == "[::]" {
        "127.0.0.1"
    } else {
        host
    };
    format!("http://{host}:{port}")
}
