mod config;
mod handlers;
mod state;

use std::time::Duration;

use axum::routing::{get, post};
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            EnvFilter::new("ninjadispute_api=debug,tower_http=info")
        }))
        .with(fmt::layer())
        .init();

    let cfg = Config::from_env()?;
    let bind_addr = cfg.bind_addr.clone();
    let state = AppState::new(cfg)?;

    let app = Router::new()
        .route("/health", get(handlers::health::health))
        .route("/auth/apple", get(handlers::apple::start))
        .route("/auth/apple/callback", post(handlers::apple::callback))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(TimeoutLayer::new(Duration::from_secs(30)))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!(addr = %bind_addr, "ninjadispute-api listening");
    axum::serve(listener, app).await?;
    Ok(())
}
