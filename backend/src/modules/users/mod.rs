use crate::{
    app::AppState,
    auth::AuthUser,
    utils::{AppResult, ListQuery, PaginatedResponse},
};
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use chrono::NaiveDateTime;
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct UserListItem {
    pub usernamenya: String,
    pub nama: String,
    pub id_pegawai: String,
    pub enabled: Option<bool>,
    pub roles: Option<String>,
    pub jmlogin: Option<i32>,
    pub loginterbaru: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct AuditLogItem {
    pub id: i64,
    pub occurred_at: NaiveDateTime,
    pub username: Option<String>,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<String>,
    pub payload: Option<serde_json::Value>,
}

async fn list_users(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<UserListItem>>> {
    let search = q.search_pattern();
    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM pengguna
        WHERE ($1::text IS NULL OR usernamenya ILIKE $1 OR nama ILIKE $1 OR id_pegawai ILIKE $1)
        "#,
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, UserListItem>(
        r#"
        SELECT usernamenya, nama, id_pegawai, enabled, roles, jmlogin, loginterbaru
        FROM pengguna
        WHERE ($1::text IS NULL OR usernamenya ILIKE $1 OR nama ILIKE $1 OR id_pegawai ILIKE $1)
        ORDER BY usernamenya
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&search)
    .bind(q.per_page())
    .bind(q.offset())
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(
        rows,
        q.page(),
        q.per_page(),
        total,
    )))
}

async fn list_audit_logs(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<AuditLogItem>>> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM neocra.audit_log")
        .fetch_one(&state.pool)
        .await?;

    let rows = sqlx::query_as::<_, AuditLogItem>(
        r#"
        SELECT id, occurred_at, username, action, entity, entity_id, payload
        FROM neocra.audit_log
        ORDER BY occurred_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(q.per_page())
    .bind(q.offset())
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(
        rows,
        q.page(),
        q.per_page(),
        total,
    )))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_users))
        .route("/audit-logs", get(list_audit_logs))
}
