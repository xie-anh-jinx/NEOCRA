use crate::{
    app::AppState,
    auth::{AuthUser, Claims},
    services::{
        audit::write_audit_log,
        notifications::{
            dispatch_to_users, get_unread_counts, NotificationItem, NotificationSpec,
            UnreadCountResponse,
        },
    },
    utils::{f64_to_dec, AppError, AppResult, PaginatedResponse},
};
use axum::{
    extract::{Path, Query, State},
    http::{header::AUTHORIZATION, HeaderMap},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, patch, post, put},
    Json, Router,
};
use chrono::NaiveDateTime;
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::{convert::Infallible, time::Duration};
use tokio_stream::{wrappers::BroadcastStream, Stream, StreamExt};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct NotificationListQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub unread_only: Option<bool>,
    pub category: Option<String>,
    pub module: Option<String>,
    pub pending_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub token: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct NotificationPreferenceDto {
    pub username: String,
    pub in_app_enabled: bool,
    pub whatsapp_enabled: bool,
    pub email_enabled: bool,
    pub whatsapp_override: Option<String>,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdatePreferenceRequest {
    pub in_app_enabled: bool,
    pub whatsapp_enabled: bool,
    pub email_enabled: bool,
    pub whatsapp_override: Option<String>,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct ApprovalRuleDto {
    pub id: i64,
    pub module: String,
    pub stage: String,
    pub target_type: String,
    pub target_value: Option<String>,
    pub branch_code: Option<String>,
    pub min_amount: f64,
    pub max_amount: Option<f64>,
    pub notify_in_app: bool,
    pub notify_whatsapp: bool,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertApprovalRuleRequest {
    pub module: String,
    pub stage: String,
    pub target_type: String,
    pub target_value: Option<String>,
    pub branch_code: Option<String>,
    pub min_amount: Option<f64>,
    pub max_amount: Option<f64>,
    pub notify_in_app: Option<bool>,
    pub notify_whatsapp: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TestNotificationRequest {
    pub title: Option<String>,
    pub message: Option<String>,
}

async fn list_notifications(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<NotificationListQuery>,
) -> AppResult<Json<PaginatedResponse<NotificationItem>>> {
    let page = q.page.unwrap_or(1).max(1);
    let per_page = q.per_page.unwrap_or(25).clamp(1, 100);
    let offset = (page - 1) * per_page;
    let unread_only = q.unread_only.unwrap_or(false);
    let pending_only = q.pending_only.unwrap_or(false);

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM neocra.notifications
        WHERE recipient_username = $1
          AND (NOT $2 OR is_read = FALSE)
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR module = $4)
          AND (NOT $5 OR (category IN ('approval_needed', 'action_needed') AND action_taken_at IS NULL))
        "#,
    )
    .bind(&auth.username)
    .bind(unread_only)
    .bind(&q.category)
    .bind(&q.module)
    .bind(pending_only)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, NotificationItem>(
        r#"
        SELECT id, recipient_username, event_id, category, module, stage,
               entity_type, entity_id, document_number, title, message,
               action_url, actor_username, metadata, is_read, read_at,
               action_taken_at, created_at
        FROM neocra.notifications
        WHERE recipient_username = $1
          AND (NOT $2 OR is_read = FALSE)
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR module = $4)
          AND (NOT $5 OR (category IN ('approval_needed', 'action_needed') AND action_taken_at IS NULL))
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&auth.username)
    .bind(unread_only)
    .bind(&q.category)
    .bind(&q.module)
    .bind(pending_only)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(rows, page, per_page, total)))
}

async fn unread_count(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<UnreadCountResponse>> {
    Ok(Json(get_unread_counts(&state.pool, &auth.username).await))
}

async fn mark_read(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<UnreadCountResponse>> {
    sqlx::query(
        r#"
        UPDATE neocra.notifications
        SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
        WHERE id = $1 AND recipient_username = $2
        "#,
    )
    .bind(id)
    .bind(&auth.username)
    .execute(&state.pool)
    .await?;

    Ok(Json(get_unread_counts(&state.pool, &auth.username).await))
}

async fn mark_all_read(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<UnreadCountResponse>> {
    sqlx::query(
        r#"
        UPDATE neocra.notifications
        SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
        WHERE recipient_username = $1 AND is_read = FALSE
        "#,
    )
    .bind(&auth.username)
    .execute(&state.pool)
    .await?;

    Ok(Json(get_unread_counts(&state.pool, &auth.username).await))
}

async fn stream_notifications(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<StreamQuery>,
) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let raw_token = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer ").or_else(|| s.strip_prefix("bearer ")))
        .map(str::to_string)
        .or(q.token)
        .ok_or_else(|| AppError::Unauthorized("Missing JWT token for notification stream".into()))?;

    let token_data = decode::<Claims>(
        &raw_token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized("Invalid or expired JWT token".into()))?;

    let username = token_data.claims.sub;
    let initial_counts = get_unread_counts(&state.pool, &username).await;
    let initial_payload = serde_json::to_string(&initial_counts).unwrap_or_else(|_| "{}".into());

    let rx = state.notif_tx.subscribe();
    let init_stream = tokio_stream::once(Ok::<Event, Infallible>(
        Event::default().event("unread_count").data(initial_payload),
    ));

    let live_stream = BroadcastStream::new(rx).filter_map(move |msg| match msg {
        Ok(push) if push.recipient_username == username => {
            let data = serde_json::to_string(&push).unwrap_or_else(|_| "{}".into());
            Some(Ok::<Event, Infallible>(
                Event::default().event("notification").data(data),
            ))
        }
        _ => None,
    });

    let combined = init_stream.chain(live_stream);

    Ok(Sse::new(combined).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(25))
            .text("ping"),
    ))
}

async fn get_preferences(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<NotificationPreferenceDto>> {
    let row = sqlx::query_as::<_, NotificationPreferenceDto>(
        r#"
        SELECT username,
               in_app_enabled,
               whatsapp_enabled,
               email_enabled,
               whatsapp_override,
               to_char(quiet_hours_start, 'HH24:MI') AS quiet_hours_start,
               to_char(quiet_hours_end, 'HH24:MI') AS quiet_hours_end
        FROM neocra.user_notification_prefs
        WHERE username = $1
        "#,
    )
    .bind(&auth.username)
    .fetch_optional(&state.pool)
    .await?;

    Ok(Json(row.unwrap_or(NotificationPreferenceDto {
        username: auth.username,
        in_app_enabled: true,
        whatsapp_enabled: true,
        email_enabled: false,
        whatsapp_override: None,
        quiet_hours_start: None,
        quiet_hours_end: None,
    })))
}

async fn update_preferences(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpdatePreferenceRequest>,
) -> AppResult<Json<NotificationPreferenceDto>> {
    let wa = req
        .whatsapp_override
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let q_start = req
        .quiet_hours_start
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let q_end = req
        .quiet_hours_end
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    sqlx::query(
        r#"
        INSERT INTO neocra.user_notification_prefs (
            username, in_app_enabled, whatsapp_enabled, email_enabled,
            whatsapp_override, quiet_hours_start, quiet_hours_end, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, NOW())
        ON CONFLICT (username) DO UPDATE SET
            in_app_enabled = EXCLUDED.in_app_enabled,
            whatsapp_enabled = EXCLUDED.whatsapp_enabled,
            email_enabled = EXCLUDED.email_enabled,
            whatsapp_override = EXCLUDED.whatsapp_override,
            quiet_hours_start = EXCLUDED.quiet_hours_start,
            quiet_hours_end = EXCLUDED.quiet_hours_end,
            updated_at = NOW()
        "#,
    )
    .bind(&auth.username)
    .bind(req.in_app_enabled)
    .bind(req.whatsapp_enabled)
    .bind(req.email_enabled)
    .bind(&wa)
    .bind(&q_start)
    .bind(&q_end)
    .execute(&state.pool)
    .await?;

    get_preferences(State(state), auth).await
}

async fn list_rules(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<ApprovalRuleDto>>> {
    let rows = sqlx::query_as::<_, ApprovalRuleDto>(
        r#"
        SELECT id, module, stage, target_type, target_value, branch_code,
               COALESCE(min_amount, 0)::float8 AS min_amount,
               max_amount::float8 AS max_amount,
               notify_in_app, notify_whatsapp, is_active,
               created_at, updated_at
        FROM neocra.approval_rules
        ORDER BY module, stage, id
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

fn validate_rule_req(req: &UpsertApprovalRuleRequest) -> AppResult<()> {
    let valid_types = ["direct_supervisor", "jabatan", "role", "username"];
    if !valid_types.contains(&req.target_type.as_str()) {
        return Err(AppError::Validation(
            "target_type harus salah satu dari: direct_supervisor, jabatan, role, username".into(),
        ));
    }
    if req.target_type != "direct_supervisor"
        && req
            .target_value
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
    {
        return Err(AppError::Validation(
            "target_value wajib diisi kecuali untuk direct_supervisor".into(),
        ));
    }
    Ok(())
}

async fn create_rule(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpsertApprovalRuleRequest>,
) -> AppResult<Json<ApprovalRuleDto>> {
    auth.require_role("ROLE_ADMIN")?;
    validate_rule_req(&req)?;

    let row = sqlx::query_as::<_, ApprovalRuleDto>(
        r#"
        INSERT INTO neocra.approval_rules (
            module, stage, target_type, target_value, branch_code,
            min_amount, max_amount, notify_in_app, notify_whatsapp, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, module, stage, target_type, target_value, branch_code,
                  COALESCE(min_amount, 0)::float8 AS min_amount,
                  max_amount::float8 AS max_amount,
                  notify_in_app, notify_whatsapp, is_active,
                  created_at, updated_at
        "#,
    )
    .bind(req.module.trim())
    .bind(req.stage.trim())
    .bind(req.target_type.trim())
    .bind(req.target_value.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(req.branch_code.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(f64_to_dec(req.min_amount.unwrap_or(0.0)))
    .bind(req.max_amount.map(f64_to_dec))
    .bind(req.notify_in_app.unwrap_or(true))
    .bind(req.notify_whatsapp.unwrap_or(false))
    .bind(req.is_active.unwrap_or(true))
    .fetch_one(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "notifications.rule.create",
        "approval_rules",
        Some(&row.id.to_string()),
        serde_json::json!({ "module": row.module, "stage": row.stage, "target_type": row.target_type, "target_value": row.target_value }),
    )
    .await;

    Ok(Json(row))
}

async fn update_rule(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
    Json(req): Json<UpsertApprovalRuleRequest>,
) -> AppResult<Json<ApprovalRuleDto>> {
    auth.require_role("ROLE_ADMIN")?;
    validate_rule_req(&req)?;

    let row = sqlx::query_as::<_, ApprovalRuleDto>(
        r#"
        UPDATE neocra.approval_rules
        SET module = $2,
            stage = $3,
            target_type = $4,
            target_value = $5,
            branch_code = $6,
            min_amount = $7,
            max_amount = $8,
            notify_in_app = $9,
            notify_whatsapp = $10,
            is_active = $11,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, module, stage, target_type, target_value, branch_code,
                  COALESCE(min_amount, 0)::float8 AS min_amount,
                  max_amount::float8 AS max_amount,
                  notify_in_app, notify_whatsapp, is_active,
                  created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(req.module.trim())
    .bind(req.stage.trim())
    .bind(req.target_type.trim())
    .bind(req.target_value.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(req.branch_code.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(f64_to_dec(req.min_amount.unwrap_or(0.0)))
    .bind(req.max_amount.map(f64_to_dec))
    .bind(req.notify_in_app.unwrap_or(true))
    .bind(req.notify_whatsapp.unwrap_or(false))
    .bind(req.is_active.unwrap_or(true))
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Approval rule #{} tidak ditemukan", id)))?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "notifications.rule.update",
        "approval_rules",
        Some(&id.to_string()),
        serde_json::json!({ "module": row.module, "stage": row.stage, "is_active": row.is_active }),
    )
    .await;

    Ok(Json(row))
}

async fn delete_rule(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i64>,
) -> AppResult<Json<OkResponse>> {
    auth.require_role("ROLE_ADMIN")?;

    let res = sqlx::query("DELETE FROM neocra.approval_rules WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound(format!(
            "Approval rule #{} tidak ditemukan",
            id
        )));
    }

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "notifications.rule.delete",
        "approval_rules",
        Some(&id.to_string()),
        serde_json::json!({ "id": id }),
    )
    .await;

    Ok(Json(OkResponse { ok: true }))
}

async fn send_test_notification(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<TestNotificationRequest>,
) -> AppResult<Json<OkResponse>> {
    auth.require_role("ROLE_ADMIN")?;

    let spec = NotificationSpec {
        event_id: None,
        category: "approval_needed".into(),
        module: "purchasing.po".into(),
        stage: Some("director".into()),
        entity_type: "po".into(),
        entity_id: "0".into(),
        document_number: "TEST/CRA-PO/XI/2026".into(),
        title: req
            .title
            .unwrap_or_else(|| "Tes Notifikasi Approval NEOCRA".into()),
        message: req
            .message
            .unwrap_or_else(|| "Notifikasi real-time SSE dan Bell Drawer aktif.".into()),
        action_url: "/purchasing/orders".into(),
        actor_username: auth.username.clone(),
        actor_id_pegawai: Some(auth.id_pegawai.clone()),
        amount: 0.0,
        metadata: serde_json::json!({ "test": true }),
    };

    dispatch_to_users(
        &state.pool,
        &state.notif_tx,
        spec,
        vec![(auth.username.clone(), false)],
        false,
    )
    .await;

    Ok(Json(OkResponse { ok: true }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_notifications))
        .route("/unread-count", get(unread_count))
        .route("/stream", get(stream_notifications))
        .route("/read-all", post(mark_all_read))
        .route("/{id}/read", patch(mark_read))
        .route("/preferences", get(get_preferences).put(update_preferences))
        .route("/rules", get(list_rules).post(create_rule))
        .route("/rules/{id}", put(update_rule).delete(delete_rule))
        .route("/test", post(send_test_notification))
}
