pub mod ai;
pub mod commands;
pub mod config;
pub mod db;
pub mod logging;
pub mod network;
pub mod plugins;
pub mod security;
pub mod sync;

use commands::DesktopState;
use config::DesktopConfig;
use db::LocalDb;
use network::ConnectionMonitor;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(mobile)]
    let builder = builder
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_nfc::init());

    builder
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("NEOCRA"));

            let guard = logging::init_logging(&app_dir);
            let _ = Box::leak(Box::new(guard));
            let cfg = DesktopConfig::load_or_create(&app_dir);
            let db_key = security::get_or_create_db_key(&app_dir);
            let db = Arc::new(LocalDb::open(&app_dir, &db_key)?);
            let monitor = Arc::new(ConnectionMonitor::new());
            let config_lock = Arc::new(RwLock::new(cfg.clone()));
            let token_lock = Arc::new(RwLock::new(None::<String>));

            let state = DesktopState {
                app_dir,
                db: db.clone(),
                monitor: monitor.clone(),
                config: config_lock.clone(),
                active_token: token_lock.clone(),
            };
            app.manage(state);

            // Background connection probe & auto-sync worker
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let current_cfg = config_lock.read().await.clone();
                    let snap = monitor
                        .probe(&current_cfg.api_url, &current_cfg.analytics_api_url)
                        .await;
                    let _ = handle.emit("connection:state_changed", &snap);

                    if snap.state == network::ConnectionState::Reconnect
                        || snap.state == network::ConnectionState::Online
                    {
                        let token = token_lock.read().await.clone();
                        if token.is_some() {
                            if let Ok(report) =
                                sync::run_full_sync(&db, &monitor, &current_cfg, token.as_deref())
                                    .await
                            {
                                let _ = handle.emit("sync:completed", &report);
                            }
                        }
                    }

                    tokio::time::sleep(std::time::Duration::from_secs(
                        current_cfg.sync_interval_secs.max(30),
                    ))
                    .await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_connection_status,
            commands::get_desktop_config,
            commands::save_desktop_config,
            commands::cache_set,
            commands::cache_get,
            commands::outbox_enqueue,
            commands::outbox_list,
            commands::outbox_retry,
            commands::outbox_discard,
            commands::trigger_sync,
            commands::set_active_token,
            commands::save_offline_session,
            commands::offline_login,
            commands::list_plugins,
            commands::get_ai_config,
            commands::check_android_update,
            commands::get_runtime_platform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NEOCRA desktop application");
}
