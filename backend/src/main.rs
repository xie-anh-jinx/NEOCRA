pub mod app;
pub mod auth;
pub mod config;
pub mod database;
pub mod events;
pub mod middleware;
pub mod modules;
pub mod services;
pub mod utils;

use app::{build_router, AppState};
use config::AppConfig;
use std::{net::SocketAddr, sync::Arc};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = AppConfig::from_env();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,neocra_backend=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Connecting to PostgreSQL database and running NEOCRA migrations...");
    let pool = database::create_pool(&config.database_url).await?;
    tracing::info!("PostgreSQL connected & NEOCRA schema verified.");

    let port = config.port;
    let state = AppState {
        pool,
        config: Arc::new(config),
    };

    let router = build_router(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("NEOCRA Backend API listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}
