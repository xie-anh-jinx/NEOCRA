use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopConfig {
    pub api_url: String,
    pub analytics_api_url: String,
    pub environment: String,
    pub company_name: String,
    pub theme: String,
    pub language: String,
    pub sync_interval_secs: u64,
    pub offline_max_days: i64,
    pub cache_retention_months: i64,
    pub release_channel: String,
    pub enabled_plugins: Vec<String>,
    pub ai_enabled: bool,
    pub ai_provider: String,
}

impl Default for DesktopConfig {
    fn default() -> Self {
        Self {
            api_url: "https://neocra.pengajaran.com/api/v1".to_string(),
            analytics_api_url: "https://warehouse.pengajaran.com/api".to_string(),
            environment: "production".to_string(),
            company_name: "PT. Cahaya Resource Abadi".to_string(),
            theme: "system".to_string(),
            language: "id".to_string(),
            sync_interval_secs: 180,
            offline_max_days: 7,
            cache_retention_months: 12,
            release_channel: "stable".to_string(),
            enabled_plugins: vec![
                "core-erp".to_string(),
                "barcode-scanner".to_string(),
                "thermal-printer".to_string(),
            ],
            ai_enabled: false,
            ai_provider: "ollama".to_string(),
        }
    }
}

impl DesktopConfig {
    pub fn load_or_create(app_dir: &PathBuf) -> Self {
        let _ = fs::create_dir_all(app_dir);
        let path = app_dir.join("config.json");
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(cfg) = serde_json::from_str::<DesktopConfig>(&raw) {
                return cfg;
            }
        }
        let default_cfg = Self::default();
        let _ = default_cfg.save(app_dir);
        default_cfg
    }

    pub fn save(&self, app_dir: &PathBuf) -> Result<(), String> {
        fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;
        let path = app_dir.join("config.json");
        let body = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, body).map_err(|e| e.to_string())
    }
}
