use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Online,
    Offline,
    Reconnect,
    Synchronizing,
    Synchronized,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionSnapshot {
    pub state: ConnectionState,
    pub axum_reachable: bool,
    pub fastapi_reachable: bool,
    pub last_checked_at: String,
}

pub struct ConnectionMonitor {
    pub http: Client,
    pub state: Arc<RwLock<ConnectionState>>,
}

impl ConnectionMonitor {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            http,
            state: Arc::new(RwLock::new(ConnectionState::Online)),
        }
    }

    pub async fn probe(&self, axum_api_url: &str, fastapi_url: &str) -> ConnectionSnapshot {
        let axum_health = format!("{}/health", axum_api_url.trim_end_matches('/'));
        let fastapi_health = format!("{}/health", fastapi_url.trim_end_matches('/'));

        let axum_ok = self
            .http
            .get(&axum_health)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        let fastapi_ok = self
            .http
            .get(&fastapi_health)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        let mut st = self.state.write().await;
        let prev = *st;
        let next = if axum_ok {
            if prev == ConnectionState::Offline {
                ConnectionState::Reconnect
            } else {
                prev
            }
        } else {
            ConnectionState::Offline
        };
        *st = next;

        ConnectionSnapshot {
            state: next,
            axum_reachable: axum_ok,
            fastapi_reachable: fastapi_ok,
            last_checked_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub async fn set_state(&self, next: ConnectionState) {
        let mut st = self.state.write().await;
        *st = next;
    }
}
