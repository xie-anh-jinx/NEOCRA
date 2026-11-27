use crate::{
    app::AppState,
    auth::AuthUser,
    services::audit::write_audit_log,
    utils::{AppError, AppResult, ListQuery, PaginatedResponse},
};
use axum::{
    extract::{Path, Query, State},
    routing::{get, patch, put},
    Json, Router,
};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct UserListItem {
    pub usernamenya: String,
    pub nama: String,
    pub id_pegawai: String,
    pub enabled: Option<bool>,
    pub roles: Option<String>,
    pub hakakses_roles: Vec<String>,
    pub jabatan: Option<String>,
    pub departemen: Option<String>,
    pub kantor: Option<String>,
    pub jmlogin: Option<i32>,
    pub loginterbaru: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct RoleMenuItem {
    pub id: i32,
    pub name: String,
    pub roles: String,
    pub parent: Option<i32>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserRolesResponse {
    pub username: String,
    pub user_role: Option<String>,
    pub menu_ids: Vec<i32>,
    pub roles: Vec<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserRolesRequest {
    pub user_role: Option<String>,
    pub menu_ids: Vec<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserStatusRequest {
    pub enabled: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
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
        SELECT
            u.usernamenya,
            u.nama,
            u.id_pegawai,
            u.enabled,
            u.roles,
            COALESCE(
                ARRAY_AGG(DISTINCT m.roles) FILTER (WHERE m.roles IS NOT NULL AND m.roles <> ''),
                ARRAY[]::text[]
            ) AS hakakses_roles,
            j.jabatan,
            d.departemen,
            k.nama AS kantor,
            u.jmlogin,
            u.loginterbaru
        FROM pengguna u
        LEFT JOIN hakakses h ON u.usernamenya = h.usernamenya
        LEFT JOIN menu m ON h.id_menu = m.id
        LEFT JOIN pegawai p ON u.id_pegawai = p.id_pegawai
        LEFT JOIN master_jabatan j ON p.id_jabatan_new = j.id_jabatan
        LEFT JOIN hr_departemen d ON p.id_departemen_new = d.id_departemen
        LEFT JOIN internal_kantor_cabang k ON p.id_kantor_new = k.id_kantor_cabang
        WHERE ($1::text IS NULL OR u.usernamenya ILIKE $1 OR u.nama ILIKE $1 OR u.id_pegawai ILIKE $1)
        GROUP BY u.usernamenya, u.nama, u.id_pegawai, u.enabled, u.roles, j.jabatan, d.departemen, k.nama, u.jmlogin, u.loginterbaru
        ORDER BY u.enabled DESC NULLS LAST, u.usernamenya
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

async fn list_roles(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<RoleMenuItem>>> {
    let rows = sqlx::query_as::<_, RoleMenuItem>(
        r#"
        SELECT id, name, roles, parent
        FROM menu
        WHERE roles IS NOT NULL AND roles <> ''
        ORDER BY roles, id
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

async fn get_user_roles(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(username): Path<String>,
) -> AppResult<Json<UserRolesResponse>> {
    let user_role: Option<Option<String>> =
        sqlx::query_scalar("SELECT roles FROM pengguna WHERE usernamenya = $1")
            .bind(&username)
            .fetch_optional(&state.pool)
            .await?;

    let user_role = user_role.ok_or_else(|| AppError::NotFound(format!("User '{}' tidak ditemukan", username)))?;

    let menu_ids: Vec<i32> = sqlx::query_scalar(
        "SELECT id_menu FROM hakakses WHERE usernamenya = $1 ORDER BY id_menu",
    )
    .bind(&username)
    .fetch_all(&state.pool)
    .await?;

    let roles: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT m.roles
        FROM hakakses h
        INNER JOIN menu m ON h.id_menu = m.id
        WHERE h.usernamenya = $1 AND m.roles IS NOT NULL AND m.roles <> ''
        ORDER BY m.roles
        "#,
    )
    .bind(&username)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(UserRolesResponse {
        username,
        user_role,
        menu_ids,
        roles,
    }))
}

async fn update_user_roles(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(username): Path<String>,
    Json(req): Json<UpdateUserRolesRequest>,
) -> AppResult<Json<OkResponse>> {
    auth.require_role("ROLE_ADMIN")?;

    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pengguna WHERE usernamenya = $1)")
            .bind(&username)
            .fetch_one(&state.pool)
            .await?;
    if !exists {
        return Err(AppError::NotFound(format!("User '{}' tidak ditemukan", username)));
    }

    let mut tx = state.pool.begin().await?;

    let clean_role = req
        .user_role
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    sqlx::query("UPDATE pengguna SET roles = $2 WHERE usernamenya = $1")
        .bind(&username)
        .bind(&clean_role)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM hakakses WHERE usernamenya = $1")
        .bind(&username)
        .execute(&mut *tx)
        .await?;

    for id_menu in &req.menu_ids {
        sqlx::query(
            "INSERT INTO hakakses (usernamenya, id_menu) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(&username)
        .bind(id_menu)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "users.update_roles",
        "pengguna",
        Some(&username),
        serde_json::json!({ "user_role": clean_role, "menu_count": req.menu_ids.len() }),
    )
    .await;

    Ok(Json(OkResponse { ok: true }))
}

async fn update_user_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(username): Path<String>,
    Json(req): Json<UpdateUserStatusRequest>,
) -> AppResult<Json<OkResponse>> {
    auth.require_role("ROLE_ADMIN")?;

    let res = sqlx::query("UPDATE pengguna SET enabled = $2 WHERE usernamenya = $1")
        .bind(&username)
        .bind(req.enabled)
        .execute(&state.pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("User '{}' tidak ditemukan", username)));
    }

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "users.update_status",
        "pengguna",
        Some(&username),
        serde_json::json!({ "enabled": req.enabled }),
    )
    .await;

    Ok(Json(OkResponse { ok: true }))
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
        .route("/roles", get(list_roles))
        .route("/{username}/roles", get(get_user_roles).put(update_user_roles))
        .route("/{username}/status", patch(update_user_status))
        .route("/audit-logs", get(list_audit_logs))
}
