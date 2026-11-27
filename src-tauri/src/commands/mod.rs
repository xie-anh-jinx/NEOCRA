use crate::ai::{get_ai_status, AiStatus};
use crate::config::DesktopConfig;
use crate::db::{LocalDb, OutboxItem};
use crate::network::{ConnectionMonitor, ConnectionSnapshot};
use crate::plugins::{default_plugins, PluginManifest};
use crate::security::{hash_offline_password, store_token, verify_offline_password};
use crate::sync::{run_full_sync, SyncReport};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub struct DesktopState {
    pub app_dir: PathBuf,
    pub db: Arc<LocalDb>,
    pub monitor: Arc<ConnectionMonitor>,
    pub config: Arc<RwLock<DesktopConfig>>,
    pub active_token: Arc<RwLock<Option<String>>>,
}

#[derive(Debug, Serialize)]
pub struct CachedEntry {
    pub payload_json: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct OfflineSessionPayload {
    pub username: String,
    pub password: String,
    pub token: String,
    pub user_json: String,
    pub menus_json: String,
}

#[derive(Debug, Serialize)]
pub struct OfflineLoginResult {
    pub ok: bool,
    pub user_json: String,
    pub menus_json: String,
}

#[tauri::command]
pub async fn get_connection_status(state: State<'_, DesktopState>) -> Result<ConnectionSnapshot, String> {
    let cfg = state.config.read().await.clone();
    Ok(state.monitor.probe(&cfg.api_url, &cfg.analytics_api_url).await)
}

#[tauri::command]
pub async fn get_desktop_config(state: State<'_, DesktopState>) -> Result<DesktopConfig, String> {
    Ok(state.config.read().await.clone())
}

#[tauri::command]
pub async fn save_desktop_config(
    state: State<'_, DesktopState>,
    new_config: DesktopConfig,
) -> Result<DesktopConfig, String> {
    new_config.save(&state.app_dir)?;
    let mut cfg = state.config.write().await;
    *cfg = new_config.clone();
    Ok(new_config)
}

#[tauri::command]
pub fn cache_set(state: State<'_, DesktopState>, key: String, payload_json: String) -> Result<(), String> {
    state.db.set_cache(&key, &payload_json)
}

#[tauri::command]
pub fn cache_get(state: State<'_, DesktopState>, key: String) -> Result<Option<CachedEntry>, String> {
    state
        .db
        .get_cache(&key)
        .map(|opt| opt.map(|(payload_json, updated_at)| CachedEntry { payload_json, updated_at }))
}

#[tauri::command]
pub fn outbox_enqueue(
    state: State<'_, DesktopState>,
    entity: String,
    method: String,
    path: String,
    payload_json: String,
) -> Result<OutboxItem, String> {
    state.db.enqueue_outbox(&entity, &method, &path, &payload_json)
}

#[tauri::command]
pub fn outbox_list(
    state: State<'_, DesktopState>,
    status: Option<String>,
) -> Result<Vec<OutboxItem>, String> {
    state.db.list_outbox(status.as_deref())
}

#[tauri::command]
pub fn outbox_retry(state: State<'_, DesktopState>, id: String) -> Result<(), String> {
    state.db.update_outbox_status(&id, "pending", 0, None, None)
}

#[tauri::command]
pub fn outbox_discard(state: State<'_, DesktopState>, id: String) -> Result<(), String> {
    state
        .db
        .update_outbox_status(&id, "discarded", 0, Some("Dibatalkan oleh pengguna"), None)
}

#[tauri::command]
pub async fn trigger_sync(state: State<'_, DesktopState>) -> Result<SyncReport, String> {
    let cfg = state.config.read().await.clone();
    let token = state.active_token.read().await.clone();
    run_full_sync(&state.db, &state.monitor, &cfg, token.as_deref()).await
}

#[tauri::command]
pub async fn set_active_token(state: State<'_, DesktopState>, token: Option<String>) -> Result<(), String> {
    let mut tk = state.active_token.write().await;
    *tk = token;
    Ok(())
}

#[tauri::command]
pub async fn save_offline_session(
    state: State<'_, DesktopState>,
    payload: OfflineSessionPayload,
) -> Result<(), String> {
    let pw_hash = hash_offline_password(&payload.password)?;
    state.db.save_offline_auth(
        &payload.username,
        &pw_hash,
        &payload.user_json,
        &payload.menus_json,
    )?;
    store_token(&payload.username, &payload.token);
    let mut tk = state.active_token.write().await;
    *tk = Some(payload.token);
    Ok(())
}

#[tauri::command]
pub async fn offline_login(
    state: State<'_, DesktopState>,
    username: String,
    password: String,
) -> Result<OfflineLoginResult, String> {
    let rec = state
        .db
        .get_offline_auth(username.trim())?
        .ok_or_else(|| "User belum pernah login online di perangkat ini".to_string())?;

    if !verify_offline_password(&password, &rec.password_hash) {
        return Err("Username atau password offline salah".to_string());
    }

    let cfg = state.config.read().await.clone();
    if let Ok(last_dt) = chrono::DateTime::parse_from_rfc3339(&rec.last_online_login_at) {
        let elapsed_days = (chrono::Utc::now() - last_dt.with_timezone(&chrono::Utc)).num_days();
        if elapsed_days > cfg.offline_max_days {
            return Err(format!(
                "Sesi offline kedaluwarsa (>{} hari tanpa login online)",
                cfg.offline_max_days
            ));
        }
    }

    Ok(OfflineLoginResult {
        ok: true,
        user_json: rec.user_json,
        menus_json: rec.menus_json,
    })
}

#[tauri::command]
pub async fn list_plugins(state: State<'_, DesktopState>) -> Result<Vec<PluginManifest>, String> {
    let cfg = state.config.read().await;
    Ok(default_plugins(&cfg.enabled_plugins))
}

#[tauri::command]
pub async fn get_ai_config(state: State<'_, DesktopState>) -> Result<AiStatus, String> {
    let cfg = state.config.read().await;
    Ok(get_ai_status(cfg.ai_enabled, &cfg.ai_provider))
}
