mod auth;
mod config;
mod db;
mod error;
mod handlers;
mod http;
mod r2;
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
        .route("/uploads/presign", post(handlers::uploads::presign))
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
        .route("/clients/:id/documents/attach", post(handlers::uploads::attach))
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

    // Always bind TCP — the browser-runner script calls back via HTTP and
    // needs a host:port. Optionally also bind a Unix domain socket so Caddy
    // can proxy to ninjacore over the loopback filesystem (skips a TCP
    // roundtrip per request — measurable on streamed PDF responses).
    let tcp_listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    tracing::info!(addr = %cfg.bind_addr, "ninjacore listening (tcp)");

    let unix_socket_path = std::env::var("UNIX_SOCKET").ok().filter(|s| !s.trim().is_empty());

    let tcp_app = app.clone();
    let tcp_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(tcp_listener, tcp_app).await {
            tracing::error!(error = %e, "tcp serve ended");
        }
    });

    if let Some(path) = unix_socket_path {
        use hyper_util::rt::{TokioExecutor, TokioIo};
        use hyper_util::server::conn::auto;
        use hyper_util::service::TowerToHyperService;
        use std::os::unix::fs::PermissionsExt;
        use tower::Service;

        // Stale socket file would block bind — ninjacore restart wouldn't work
        // without this. Caddy gracefully reconnects.
        let _ = std::fs::remove_file(&path);
        let unix_listener = tokio::net::UnixListener::bind(&path)?;
        // 0o660 + a shared group between caddy & ninjacore is the right
        // long-term answer; 0o666 is fine for single-user dev/prod boxes.
        let mode: u32 = std::env::var("UNIX_SOCKET_MODE")
            .ok()
            .and_then(|s| u32::from_str_radix(s.trim_start_matches("0o"), 8).ok())
            .unwrap_or(0o666);
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode))?;
        tracing::info!(path = %path, mode = format!("0o{:o}", mode), "ninjacore listening (unix)");

        // axum 0.7's `axum::serve` only accepts `TcpListener`, so wire the
        // unix socket up to hyper-util directly. Same Router → Service stack,
        // same handlers — just a different transport.
        let unix_app = app;
        tokio::spawn(async move {
            let mut make_svc = unix_app.into_make_service();
            loop {
                let (stream, _addr) = match unix_listener.accept().await {
                    Ok(v) => v,
                    Err(e) => {
                        tracing::error!(error = %e, "unix accept failed");
                        continue;
                    }
                };
                let tower_svc = match make_svc.call(()).await {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::error!(error = %e, "make_service call failed");
                        continue;
                    }
                };
                let hyper_svc = TowerToHyperService::new(tower_svc);
                tokio::spawn(async move {
                    if let Err(e) = auto::Builder::new(TokioExecutor::new())
                        .serve_connection(TokioIo::new(stream), hyper_svc)
                        .await
                    {
                        tracing::debug!(error = %e, "unix conn closed");
                    }
                });
            }
        });
    }

    tcp_handle.await?;
    Ok(())
}
