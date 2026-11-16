use crate::events::DomainEvent;
use redis::AsyncCommands;
use sqlx::PgPool;

pub async fn emit_event(pool: &PgPool, redis_url: Option<&str>, event: DomainEvent) {
    let res = sqlx::query(
        r#"
        INSERT INTO neocra.outbox_events (id, event_type, aggregate, aggregate_id, payload)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(event.id)
    .bind(&event.event_type)
    .bind(&event.aggregate)
    .bind(&event.aggregate_id)
    .bind(&event.payload)
    .execute(pool)
    .await;

    if let Err(err) = res {
        tracing::warn!(error = ?err, "Failed to insert outbox event");
        return;
    }

    if let Some(url) = redis_url {
        if let Ok(client) = redis::Client::open(url) {
            if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
                if let Ok(json_str) = serde_json::to_string(&event) {
                    let pub_res: Result<(), redis::RedisError> =
                        conn.publish("neocra.events", json_str).await;
                    if pub_res.is_ok() {
                        let _ = sqlx::query(
                            "UPDATE neocra.outbox_events SET published_at = NOW() WHERE id = $1",
                        )
                        .bind(event.id)
                        .execute(pool)
                        .await;
                    }
                }
            }
        }
    }
}
