//! Process-wide pooled `reqwest::Client`.
//!
//! Every outbound HTTP call in ninjacore should go through `shared()` so that
//! TLS sessions and HTTP/2 streams are reused across requests. Creating a new
//! `reqwest::Client` per call throws away the connection pool and forces a
//! fresh TCP + TLS handshake — measurable latency cost on every external API
//! hit (R2, NMI, Square, NinjaDispute, GoHighLevel, etc.).

use std::time::Duration;

use once_cell::sync::Lazy;

static SHARED: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .pool_max_idle_per_host(32)
        .pool_idle_timeout(Duration::from_secs(90))
        .tcp_keepalive(Duration::from_secs(60))
        .http2_adaptive_window(true)
        .http2_keep_alive_interval(Duration::from_secs(30))
        .http2_keep_alive_while_idle(true)
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .gzip(true)
        .build()
        .expect("reqwest client build")
});

/// Shared `reqwest::Client`. Cloning is cheap — internals are Arc'd — so
/// callers can `.clone()` freely or hold the `&'static` reference directly.
pub fn shared() -> reqwest::Client {
    SHARED.clone()
}
