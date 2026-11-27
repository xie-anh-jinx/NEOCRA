use crate::config::DesktopConfig;
use crate::db::{LocalDb, OutboxItem};
use crate::network::{ConnectionMonitor, ConnectionState};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Debug, Clone, Serialize)]
pub struct SyncReport {
    pub pushed_ok: usize,
    pub pushed_conflict: usize,
    pub pushed_failed: usize,
    pub pulled_entities: usize,
    pub pulled_rows: usize,
    pub finished_at: String,
}

#[derive(Debug, Deserialize)]
struct DeltaApiResponse {
    rows: Vec<serde_json::Value>,
}

const SYNC_ENTITIES: &[&str] = &[
    "barang",
    "customer",
    "supplier",
    "gudang",
    "stok_barang",
    "permintaan_pembelian",
    "po",
    "so",
    "penjualan",
];

pub async fn run_full_sync(
    db: &LocalDb,
    monitor: &ConnectionMonitor,
    cfg: &DesktopConfig,
    token: Option<&str>,
) -> Result<SyncReport, String> {
    monitor.set_state(ConnectionState::Synchronizing).await;

    let mut report = SyncReport {
        pushed_ok: 0,
        pushed_conflict: 0,
        pushed_failed: 0,
        pulled_entities: 0,
        pulled_rows: 0,
        finished_at: chrono::Utc::now().to_rfc3339(),
    };

    // 1. Push local_outbox (FIFO, with Idempotency-Key & conflict/retry handling)
    let pending_items = db.list_outbox(Some("pending"))?;
    for item in pending_items {
        match push_outbox_item(db, monitor, cfg, token, &item).await {
            Ok(PushOutcome::Synced) => report.pushed_ok += 1,
            Ok(PushOutcome::Conflict) => report.pushed_conflict += 1,
            Err(_) => report.pushed_failed += 1,
        }
    }

    // 2. Pull delta from Rust Axum API
    if let Some(jwt) = token {
        for entity in SYNC_ENTITIES {
            let url = format!(
                "{}/sync/delta?entity={}&limit=500",
                cfg.api_url.trim_end_matches('/'),
                entity
            );
            match monitor.http.get(&url).bearer_auth(jwt).send().await {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(delta) = resp.json::<DeltaApiResponse>().await {
                        let count = delta.rows.len();
                        if let Ok(raw) = serde_json::to_string(&delta.rows) {
                            let _ = db.set_cache(&format!("delta:{}", entity), &raw);
                        }
                        report.pulled_entities += 1;
                        report.pulled_rows += count;
                        db.log_sync("info", entity, &format!("Pulled {} rows", count));
                    }
                }
                Ok(resp) => {
                    db.log_sync("warn", entity, &format!("Pull HTTP {}", resp.status()));
                }
                Err(e) => {
                    db.log_sync("error", entity, &format!("Pull error: {}", e));
                    monitor.set_state(ConnectionState::Offline).await;
                    return Err(e.to_string());
                }
            }
        }
    }

    report.finished_at = chrono::Utc::now().to_rfc3339();
    monitor.set_state(ConnectionState::Synchronized).await;
    Ok(report)
}

enum PushOutcome {
    Synced,
    Conflict,
}

async fn push_outbox_item(
    db: &LocalDb,
    monitor: &ConnectionMonitor,
    cfg: &DesktopConfig,
    token: Option<&str>,
    item: &OutboxItem,
) -> Result<PushOutcome, String> {
    let jwt = token.ok_or_else(|| "No active token for push".to_string())?;
    let method = Method::from_str(&item.method.to_uppercase()).unwrap_or(Method::POST);
    let url = format!(
        "{}{}",
        cfg.api_url.trim_end_matches('/'),
        if item.path.starts_with('/') {
            item.path.clone()
        } else {
            format!("/{}", item.path)
        }
    );

    let payload: serde_json::Value =
        serde_json::from_str(&item.payload_json).unwrap_or(serde_json::json!({}));

    let resp = monitor
        .http
        .request(method, &url)
        .bearer_auth(jwt)
        .header("Idempotency-Key", &item.idempotency_key)
        .json(&payload)
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let status_code = r.status().as_u16() as i32;
            let body_val = r.json::<serde_json::Value>().await.unwrap_or(serde_json::json!({}));
            let ack_url = format!("{}/sync/ack", cfg.api_url.trim_end_matches('/'));
            let _ = monitor
                .http
                .post(&ack_url)
                .bearer_auth(jwt)
                .json(&serde_json::json!({
                    "idempotency_key": item.idempotency_key,
                    "entity": item.entity,
                    "method": item.method,
                    "path": item.path,
                    "response_status": status_code,
                    "response_body": body_val,
                }))
                .send()
                .await;

            db.update_outbox_status(&item.id, "synced", item.retry_count, None, None)?;
            db.log_sync("info", &item.entity, &format!("Synced outbox {}", item.id));
            Ok(PushOutcome::Synced)
        }
        Ok(r) if r.status().as_u16() == 409 => {
            let err_txt = r.text().await.unwrap_or_else(|_| "409 Conflict".into());
            db.update_outbox_status(&item.id, "conflict", item.retry_count, Some(&err_txt), None)?;
            db.log_sync("warn", &item.entity, &format!("Conflict on {}", item.id));
            Ok(PushOutcome::Conflict)
        }
        Ok(r) if r.status().is_client_error() => {
            let err_txt = r.text().await.unwrap_or_else(|_| "Client error".into());
            db.update_outbox_status(&item.id, "failed", item.retry_count + 1, Some(&err_txt), None)?;
            Err(err_txt)
        }
        Ok(r) => {
            let next_retry = item.retry_count + 1;
            let backoff_secs = (10_i64 * 2_i64.pow(next_retry.min(6) as u32)).min(600);
            let next_at = (chrono::Utc::now() + chrono::Duration::seconds(backoff_secs)).to_rfc3339();
            let err_msg = format!("Server HTTP {}", r.status());
            db.update_outbox_status(&item.id, "pending", next_retry, Some(&err_msg), Some(&next_at))?;
            Err(err_msg)
        }
        Err(e) => {
            let next_retry = item.retry_count + 1;
            let backoff_secs = (10_i64 * 2_i64.pow(next_retry.min(6) as u32)).min(600);
            let next_at = (chrono::Utc::now() + chrono::Duration::seconds(backoff_secs)).to_rfc3339();
            let err_msg = e.to_string();
            db.update_outbox_status(&item.id, "pending", next_retry, Some(&err_msg), Some(&next_at))?;
            Err(err_msg)
        }
    }
}
