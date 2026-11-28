use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::collections::HashSet;
use tokio::sync::broadcast;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct NotificationItem {
    pub id: Uuid,
    pub recipient_username: String,
    pub event_id: Option<Uuid>,
    pub category: String,
    pub module: String,
    pub stage: Option<String>,
    pub entity_type: String,
    pub entity_id: String,
    pub document_number: String,
    pub title: String,
    pub message: String,
    pub action_url: String,
    pub actor_username: Option<String>,
    pub metadata: serde_json::Value,
    pub is_read: bool,
    pub read_at: Option<NaiveDateTime>,
    pub action_taken_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UnreadCountResponse {
    pub unread: i64,
    pub pending_approvals: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationPush {
    pub recipient_username: String,
    pub notification: NotificationItem,
    pub unread: i64,
    pub pending_approvals: i64,
}

#[derive(Debug, FromRow)]
struct RuleRow {
    target_type: String,
    target_value: Option<String>,
    branch_code: Option<String>,
    notify_in_app: bool,
    notify_whatsapp: bool,
}

#[derive(Debug, Clone)]
pub struct NotificationSpec {
    pub event_id: Option<Uuid>,
    pub category: String,
    pub module: String,
    pub stage: Option<String>,
    pub entity_type: String,
    pub entity_id: String,
    pub document_number: String,
    pub title: String,
    pub message: String,
    pub action_url: String,
    pub actor_username: String,
    pub actor_id_pegawai: Option<String>,
    pub amount: f64,
    pub metadata: serde_json::Value,
}

pub async fn get_unread_counts(pool: &PgPool, username: &str) -> UnreadCountResponse {
    let unread: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM neocra.notifications WHERE recipient_username = $1 AND is_read = FALSE",
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let pending_approvals: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM neocra.notifications
        WHERE recipient_username = $1
          AND category IN ('approval_needed', 'action_needed')
          AND action_taken_at IS NULL
        "#,
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    UnreadCountResponse {
        unread,
        pending_approvals,
    }
}

pub async fn mark_stage_action_taken(
    pool: &PgPool,
    entity_type: &str,
    entity_id: &str,
    stages: &[&str],
) {
    if stages.is_empty() {
        let _ = sqlx::query(
            r#"
            UPDATE neocra.notifications
            SET action_taken_at = NOW()
            WHERE entity_type = $1
              AND entity_id = $2
              AND action_taken_at IS NULL
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .execute(pool)
        .await;
    } else {
        let stage_vec: Vec<String> = stages.iter().map(|s| s.to_string()).collect();
        let _ = sqlx::query(
            r#"
            UPDATE neocra.notifications
            SET action_taken_at = NOW()
            WHERE entity_type = $1
              AND entity_id = $2
              AND stage = ANY($3)
              AND action_taken_at IS NULL
            "#,
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(&stage_vec)
        .execute(pool)
        .await;
    }
}

pub async fn lookup_username_by_pegawai(pool: &PgPool, id_pegawai: &str) -> Option<String> {
    sqlx::query_scalar(
        "SELECT usernamenya FROM pengguna WHERE id_pegawai = $1 AND COALESCE(enabled, true) = true LIMIT 1",
    )
    .bind(id_pegawai)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}

pub async fn resolve_stage_recipients(
    pool: &PgPool,
    module: &str,
    stage: &str,
    creator_id_pegawai: Option<&str>,
    amount: f64,
) -> Vec<(String, bool)> {
    let rules = sqlx::query_as::<_, RuleRow>(
        r#"
        SELECT target_type, target_value, branch_code, notify_in_app, notify_whatsapp
        FROM neocra.approval_rules
        WHERE module = $1
          AND stage = $2
          AND is_active = TRUE
          AND COALESCE(min_amount, 0)::float8 <= $3
          AND (max_amount IS NULL OR max_amount::float8 >= $3)
        "#,
    )
    .bind(module)
    .bind(stage)
    .bind(amount)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<(String, bool)> = Vec::new();

    for rule in rules {
        if !rule.notify_in_app && !rule.notify_whatsapp {
            continue;
        }
        let matched: Vec<String> = match rule.target_type.as_str() {
            "direct_supervisor" => {
                if let Some(pid) = creator_id_pegawai {
                    sqlx::query_scalar(
                        r#"
                        SELECT DISTINCT u.usernamenya
                        FROM pegawai p
                        INNER JOIN pengguna u ON u.id_pegawai = p.atasan_langsung
                        WHERE p.id_pegawai = $1
                          AND p.atasan_langsung IS NOT NULL
                          AND p.atasan_langsung <> ''
                          AND COALESCE(u.enabled, true) = true
                        "#,
                    )
                    .bind(pid)
                    .fetch_all(pool)
                    .await
                    .unwrap_or_default()
                } else {
                    Vec::new()
                }
            }
            "jabatan" => {
                if let Some(val) = rule.target_value.as_deref().and_then(|s| s.parse::<i32>().ok()) {
                    sqlx::query_scalar(
                        r#"
                        SELECT DISTINCT u.usernamenya
                        FROM pengguna u
                        INNER JOIN pegawai p ON u.id_pegawai = p.id_pegawai
                        WHERE p.id_jabatan_new = $1
                          AND COALESCE(u.enabled, true) = true
                          AND ($2::text IS NULL OR p.id_kantor_new = $2)
                        "#,
                    )
                    .bind(val)
                    .bind(&rule.branch_code)
                    .fetch_all(pool)
                    .await
                    .unwrap_or_default()
                } else {
                    Vec::new()
                }
            }
            "role" => {
                if let Some(role) = rule.target_value.as_deref() {
                    sqlx::query_scalar(
                        r#"
                        SELECT DISTINCT u.usernamenya
                        FROM pengguna u
                        INNER JOIN hakakses h ON u.usernamenya = h.usernamenya
                        INNER JOIN menu m ON h.id_menu = m.id
                        LEFT JOIN pegawai p ON u.id_pegawai = p.id_pegawai
                        WHERE m.roles = $1
                          AND COALESCE(u.enabled, true) = true
                          AND ($2::text IS NULL OR p.id_kantor_new = $2)
                        "#,
                    )
                    .bind(role)
                    .bind(&rule.branch_code)
                    .fetch_all(pool)
                    .await
                    .unwrap_or_default()
                } else {
                    Vec::new()
                }
            }
            "username" => {
                if let Some(uname) = rule.target_value.as_deref() {
                    sqlx::query_scalar(
                        "SELECT usernamenya FROM pengguna WHERE usernamenya = $1 AND COALESCE(enabled, true) = true",
                    )
                    .bind(uname)
                    .fetch_all(pool)
                    .await
                    .unwrap_or_default()
                } else {
                    Vec::new()
                }
            }
            _ => Vec::new(),
        };

        for u in matched {
            if seen.insert(u.clone()) {
                results.push((u, rule.notify_whatsapp));
            }
        }
    }

    // Fallback to active ROLE_ADMIN users if no rule resolved any recipient
    if results.is_empty() {
        let admins: Vec<String> = sqlx::query_scalar(
            "SELECT usernamenya FROM pengguna WHERE roles = 'ROLE_ADMIN' AND COALESCE(enabled, true) = true LIMIT 10",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for u in admins {
            if seen.insert(u.clone()) {
                results.push((u, false));
            }
        }
    }

    results
}

pub async fn dispatch_to_users(
    pool: &PgPool,
    notif_tx: &broadcast::Sender<NotificationPush>,
    spec: NotificationSpec,
    recipients: Vec<(String, bool)>,
    exclude_actor_if_others: bool,
) {
    if recipients.is_empty() {
        return;
    }

    let filtered: Vec<(String, bool)> = if exclude_actor_if_others {
        let non_actor: Vec<(String, bool)> = recipients
            .iter()
            .filter(|(u, _)| u != &spec.actor_username)
            .cloned()
            .collect();
        if non_actor.is_empty() {
            recipients
        } else {
            non_actor
        }
    } else {
        recipients
    };

    for (recipient, queue_wa) in filtered {
        // Respect user's in_app_enabled preference if configured
        let in_app_enabled: bool = sqlx::query_scalar(
            "SELECT COALESCE((SELECT in_app_enabled FROM neocra.user_notification_prefs WHERE username = $1), true)",
        )
        .bind(&recipient)
        .fetch_one(pool)
        .await
        .unwrap_or(true);

        if !in_app_enabled {
            continue;
        }

        let id = Uuid::new_v4();
        let inserted = sqlx::query_as::<_, NotificationItem>(
            r#"
            INSERT INTO neocra.notifications (
                id, recipient_username, event_id, category, module, stage,
                entity_type, entity_id, document_number, title, message,
                action_url, actor_username, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT DO NOTHING
            RETURNING id, recipient_username, event_id, category, module, stage,
                      entity_type, entity_id, document_number, title, message,
                      action_url, actor_username, metadata, is_read, read_at,
                      action_taken_at, created_at
            "#,
        )
        .bind(id)
        .bind(&recipient)
        .bind(spec.event_id)
        .bind(&spec.category)
        .bind(&spec.module)
        .bind(&spec.stage)
        .bind(&spec.entity_type)
        .bind(&spec.entity_id)
        .bind(&spec.document_number)
        .bind(&spec.title)
        .bind(&spec.message)
        .bind(&spec.action_url)
        .bind(&spec.actor_username)
        .bind(&spec.metadata)
        .fetch_optional(pool)
        .await;

        let item = match inserted {
            Ok(Some(row)) => row,
            Ok(None) => continue,
            Err(err) => {
                tracing::warn!(error = ?err, recipient = %recipient, "Failed to insert notification");
                continue;
            }
        };

        // Queue external WhatsApp delivery log if rule requests it (ready for Phase 2 sender)
        if queue_wa {
            let wa_dest: Option<String> = sqlx::query_scalar(
                r#"
                SELECT COALESCE(
                    NULLIF(pref.whatsapp_override, ''),
                    NULLIF(p.wa, ''),
                    NULLIF(p.hp, '')
                )
                FROM pengguna u
                LEFT JOIN pegawai p ON u.id_pegawai = p.id_pegawai
                LEFT JOIN neocra.user_notification_prefs pref ON pref.username = u.usernamenya
                WHERE u.usernamenya = $1
                  AND COALESCE(pref.whatsapp_enabled, true) = true
                "#,
            )
            .bind(&recipient)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            if let Some(dest) = wa_dest {
                let _ = sqlx::query(
                    r#"
                    INSERT INTO neocra.notification_deliveries (notification_id, channel, destination, status)
                    VALUES ($1, 'whatsapp', $2, 'pending')
                    ON CONFLICT (notification_id, channel) DO NOTHING
                    "#,
                )
                .bind(item.id)
                .bind(&dest)
                .execute(pool)
                .await;
            }
        }

        let counts = get_unread_counts(pool, &recipient).await;
        let _ = notif_tx.send(NotificationPush {
            recipient_username: recipient,
            notification: item,
            unread: counts.unread,
            pending_approvals: counts.pending_approvals,
        });
    }
}

pub fn spawn_stage_notification(
    pool: PgPool,
    notif_tx: broadcast::Sender<NotificationPush>,
    spec: NotificationSpec,
    target_stages: Vec<String>,
) {
    tokio::spawn(async move {
        let mut seen: HashSet<String> = HashSet::new();
        let mut all_recipients: Vec<(String, bool)> = Vec::new();

        for stage in &target_stages {
            let matched = resolve_stage_recipients(
                &pool,
                &spec.module,
                stage,
                spec.actor_id_pegawai.as_deref(),
                spec.amount,
            )
            .await;
            for (u, wa) in matched {
                if seen.insert(u.clone()) {
                    all_recipients.push((u, wa));
                }
            }
        }

        dispatch_to_users(&pool, &notif_tx, spec, all_recipients, true).await;
    });
}

pub fn spawn_direct_notification(
    pool: PgPool,
    notif_tx: broadcast::Sender<NotificationPush>,
    spec: NotificationSpec,
    target_usernames: Vec<String>,
) {
    tokio::spawn(async move {
        let recipients: Vec<(String, bool)> = target_usernames
            .into_iter()
            .map(|u| (u, false))
            .collect();
        dispatch_to_users(&pool, &notif_tx, spec, recipients, true).await;
    });
}
