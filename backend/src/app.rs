use crate::{
    auth::{self, ChangePasswordRequest, LoginRequest, LoginResponse, MenuNode, OkResponse, UserProfile},
    config::AppConfig,
    modules,
    services::notifications::NotificationPush,
    utils::{ErrorBody, ErrorEnvelope},
};
use axum::{
    extract::State,
    http::{header, HeaderValue, Method},
    response::Html,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use utoipa::{OpenApi, ToSchema};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<AppConfig>,
    pub notif_tx: broadcast::Sender<NotificationPush>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: &'static str,
    pub database: &'static str,
    pub redis: &'static str,
    pub version: &'static str,
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health_handler,
        auth::login_handler,
        auth::me_handler,
        auth::menus_handler,
        auth::change_password_handler,
    ),
    components(schemas(
        HealthResponse,
        LoginRequest,
        LoginResponse,
        UserProfile,
        MenuNode,
        ChangePasswordRequest,
        OkResponse,
        ErrorEnvelope,
        ErrorBody,
    )),
    tags(
        (name = "System", description = "Health & OpenAPI specification"),
        (name = "Auth", description = "Authentication, RBAC & User Profile"),
        (name = "Master", description = "Master Data (Items, Suppliers, Customers, Employees)"),
        (name = "Inventory", description = "Warehouse Stock & Stock Card Ledger"),
        (name = "Purchasing", description = "Purchase Requests (PP) & Purchase Orders (PO)"),
        (name = "Sales", description = "Sales Orders (SO) & Invoices"),
        (name = "Warehouse", description = "Goods Receipts (Penerimaan) & Delivery Orders (DO)"),
        (name = "Finance", description = "COA, Accounts Receivable (AR), Accounts Payable (AP), General Ledger, Cash"),
        (name = "Reporting", description = "Executive Dashboard KPIs & Trends")
    ),
    info(
        title = "NEOCRA ERP API",
        version = "0.1.0",
        description = "API-first Corporate Resource Application (CRA ERP v1) powered by Rust + Axum + SQLx"
    )
)]
pub struct ApiDoc;

#[utoipa::path(
    get,
    path = "/health",
    responses((status = 200, body = HealthResponse)),
    tag = "System"
)]
pub async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();

    let redis_status = match state.config.redis_url.as_deref() {
        None => "disabled",
        Some(url) => match redis::Client::open(url) {
            Ok(c) => match c.get_multiplexed_async_connection().await {
                Ok(_) => "ok",
                Err(_) => "error",
            },
            Err(_) => "error",
        },
    };

    Json(HealthResponse {
        status: if db_ok { "ok" } else { "degraded" },
        database: if db_ok { "ok" } else { "error" },
        redis: redis_status,
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn openapi_json_handler() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

async fn swagger_ui_handler() -> Html<&'static str> {
    Html(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NEOCRA ERP API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
<script>
  window.onload = () => {
    window.ui = SwaggerUIBundle({
      url: '/api-docs/openapi.json',
      dom_id: '#swagger-ui',
    });
  };
</script>
</body>
</html>"#,
    )
}

pub fn build_router(state: AppState) -> Router {
    let origins: Vec<HeaderValue> = state
        .config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse::<HeaderValue>().ok())
        .collect();

    let cors = if origins.is_empty() {
        CorsLayer::very_permissive()
    } else {
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                header::HeaderName::from_static("idempotency-key"),
            ])
            .allow_credentials(true)
    };

    let api_v1 = Router::new()
        .route("/health", get(health_handler))
        .nest("/auth", auth::router())
        .nest("/users", modules::users::router())
        .nest("/company", modules::company::router())
        .nest("/master", modules::master::router())
        .nest("/inventory", modules::inventory::router())
        .nest("/purchasing", modules::purchasing::router())
        .nest("/sales", modules::sales::router())
        .nest("/warehouse", modules::warehouse::router())
        .nest("/finance", modules::finance::router())
        .nest("/reporting", modules::reporting::router())
        .nest("/notifications", modules::notifications::router())
        .nest("/sync", modules::sync::router());

    Router::new()
        .route("/health", get(health_handler))
        .route("/api-docs/openapi.json", get(openapi_json_handler))
        .route("/docs", get(swagger_ui_handler))
        .nest("/api/v1", api_v1)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
