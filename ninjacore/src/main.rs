mod auth;
mod config;
mod db;
mod error;
mod handlers;
mod report_run;
mod state;

use std::time::Duration;

use axum::routing::{get, post, put};
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use axum::response::Redirect;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("ninjacore=debug,tower_http=info")))
        .with(fmt::layer())
        .init();

    let cfg = Config::from_env()?;
    let db = db::connect_db(&cfg).await?;
    let state = AppState::new(cfg.clone(), db)?;

    let api = Router::new()
        // Health + auth
        .route("/health", get(handlers::health::health))
        .route("/login", post(handlers::auth::login))
        .route("/signup", post(handlers::auth::signup))
        .route("/logout", post(handlers::auth::logout))
        .route("/auth/status", get(handlers::auth::auth_status))
        // Business settings
        .route(
            "/business-settings",
            get(handlers::settings::get_business_settings)
                .put(handlers::settings::put_business_settings),
        )
        // Integrations
        .route("/integrations", get(handlers::settings::list_integrations))
        .route("/integrations/:service", put(handlers::settings::put_integration))
        // GHL webhook (no auth — keyed)
        .route(
            "/integrations/gohighlevel/webhook",
            post(handlers::ghl::webhook),
        )
        // Payments
        .route("/payments/overview", get(handlers::payments::overview))
        .route("/payments/config", put(handlers::payments::put_config))
        .route("/payments/merchants", post(handlers::payments::create_merchant))
        .route(
            "/payments/merchants/:id",
            put(handlers::payments::update_merchant).delete(handlers::payments::delete_merchant),
        )
        .route("/payments/test-square", post(handlers::payments::test_square))
        .route("/payments/products", post(handlers::payments::create_product))
        .route(
            "/payments/products/:id",
            put(handlers::payments::update_product).delete(handlers::payments::delete_product),
        )
        .route("/payments/autopay", post(handlers::payments::create_autopay))
        .route(
            "/payments/autopay/:id",
            put(handlers::payments::update_autopay).delete(handlers::payments::delete_autopay),
        )
        // SSO
        .route("/auth/sso-login", post(handlers::sso::sso_login))
        // Address suggestions (public)
        .route("/address-suggestions", get(handlers::misc::address_suggestions))
        // Documents
        .route("/documents/proxy", get(handlers::documents::proxy))
        .route("/admin/migrate-documents-to-s3", post(handlers::documents::migrate_to_s3))
        // Vantage simulator (stub)
        .route("/simulator/vantage", post(handlers::misc::vantage))
        // Training
        .route("/training/clients", get(handlers::training::list_clients))
        .route(
            "/training/context/session",
            get(handlers::training::get_session).post(handlers::training::post_session),
        )
        .route(
            "/training/context/public/:context_id",
            get(handlers::training::get_public_context),
        )
        .route("/training/ai/rewrite", post(handlers::training::ai_rewrite))
        .route(
            "/training/clients/:client_id/derogatory",
            get(handlers::derogatory::get_derogatory),
        )
        // Billing
        .route("/billing/failed-payments", get(handlers::billing::failed_payments))
        .route("/billing/safe-query-all-failed-trans", post(handlers::billing::safe_query))
        // Affiliate links
        .route("/affiliate-links", get(handlers::affiliate::list_links))
        .route("/affiliate-links/credit-builder", put(handlers::affiliate::put_builder))
        .route("/affiliate-links/credit-monitoring", put(handlers::affiliate::put_monitoring))
        // Taxonomy
        .route("/client-statuses", post(handlers::misc::add_status))
        .route("/client-phases", post(handlers::misc::add_phase))
        // Uploads
        .route("/uploads/text-attachment", post(handlers::misc::upload_text_attachment))
        // Clients full CRUD
        .route("/clients", get(handlers::clients::list_clients).post(handlers::misc::create_client))
        .route(
            "/clients/:id",
            get(handlers::clients::get_client).delete(handlers::clients::delete_client),
        )
        .route("/clients/:id/status", axum::routing::patch(handlers::clients::patch_status))
        .route("/clients/:id/phase", axum::routing::patch(handlers::clients::patch_phase))
        .route("/clients/:id/next-import", axum::routing::patch(handlers::clients::patch_next_import))
        .route("/clients/:id/financial-profile", axum::routing::patch(handlers::clients::patch_financial))
        .route("/clients/:id/profile", axum::routing::patch(handlers::clients::patch_profile))
        .route("/clients/:id/refresh-report", post(handlers::clients::refresh_report))
        .route("/report-runs/:id", get(handlers::clients::get_report_run))
        .route("/clients/import-csv", post(handlers::misc::import_csv))
        // Report sync (stubs)
        .route("/report-sync/identityiq", post(handlers::misc::report_sync_iiq))
        .route("/report-sync/smartcredit", post(handlers::misc::report_sync_sc));


    // Static file serving + pretty URL aliases (mirrors server.mjs).
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "public".into());
    let serve_dir = ServeDir::new(&static_dir).append_index_html_on_directories(true);

    let app = Router::new()
        .nest("/api", api)
        // Pretty URLs — Node served specific HTML for these paths.
        .route("/billing", get(|| async { Redirect::permanent("/billing.html") }))
        .route("/payments", get(|| async { Redirect::permanent("/payments.html") }))
        .route("/add-clients", get(|| async { Redirect::permanent("/add-client.html") }))
        .route("/add-client", get(|| async { Redirect::permanent("/add-client.html") }))
        .route("/training", get(|| async { Redirect::permanent("/training.html") }))
        .route("/Training", get(|| async { Redirect::permanent("/training.html") }))
        .route("/learning", get(|| async { Redirect::permanent("/learning.html") }))
        .route("/Learning", get(|| async { Redirect::permanent("/learning.html") }))
        // Static assets fall through to ServeDir.
        .fallback_service(serve_dir)
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

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    tracing::info!(addr = %cfg.bind_addr, "ninjacore listening");
    axum::serve(listener, app).await?;
    Ok(())
}
