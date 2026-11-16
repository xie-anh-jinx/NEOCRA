use sqlx::PgPool;

pub async fn write_audit_log(
    pool: &PgPool,
    username: Option<&str>,
    action: &str,
    entity: &str,
    entity_id: Option<&str>,
    payload: serde_json::Value,
) {
    let res = sqlx::query(
        r#"
        INSERT INTO neocra.audit_log (username, action, entity, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(username)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(payload)
    .execute(pool)
    .await;

    if let Err(err) = res {
        tracing::warn!(error = ?err, "Failed to write audit log");
    }
}
