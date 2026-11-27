use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct LocalDb {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxItem {
    pub id: String,
    pub idempotency_key: String,
    pub entity: String,
    pub method: String,
    pub path: String,
    pub payload_json: String,
    pub status: String, // pending | synced | conflict | failed
    pub retry_count: i32,
    pub last_error: Option<String>,
    pub created_at: String,
    pub next_retry_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineUserRecord {
    pub username: String,
    pub password_hash: String,
    pub user_json: String,
    pub menus_json: String,
    pub last_online_login_at: String,
}

impl LocalDb {
    pub fn open(app_dir: &PathBuf, encryption_key: &str) -> Result<Self, String> {
        std::fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("neocra_local.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        // Enable SQLCipher AES-256 encryption + WAL mode
        conn.pragma_update(None, "key", encryption_key)
            .map_err(|e| format!("SQLCipher key error: {}", e))?;
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        let _ = conn.pragma_update(None, "synchronous", "NORMAL");

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sync_state (
                entity TEXT PRIMARY KEY,
                last_sync_at TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS api_cache (
                cache_key TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS local_outbox (
                id TEXT PRIMARY KEY,
                idempotency_key TEXT UNIQUE NOT NULL,
                entity TEXT NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                created_at TEXT NOT NULL,
                next_retry_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_outbox_status ON local_outbox(status, created_at);

            CREATE TABLE IF NOT EXISTS offline_auth (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                user_json TEXT NOT NULL,
                menus_json TEXT NOT NULL DEFAULT '[]',
                last_online_login_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                level TEXT NOT NULL,
                entity TEXT NOT NULL,
                message TEXT NOT NULL
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS fts_search USING fts5(
                entity,
                record_id,
                title,
                body
            );
            "#,
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn set_cache(&self, key: &str, payload_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO api_cache (cache_key, payload_json, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at",
            params![key, payload_json, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_cache(&self, key: &str) -> Result<Option<(String, String)>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT payload_json, updated_at FROM api_cache WHERE cache_key = ?1",
            params![key],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn enqueue_outbox(
        &self,
        entity: &str,
        method: &str,
        path: &str,
        payload_json: &str,
    ) -> Result<OutboxItem, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        let idempotency_key = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO local_outbox (id, idempotency_key, entity, method, path, payload_json, status, retry_count, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', 0, ?7)",
            params![id, idempotency_key, entity, method, path, payload_json, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(OutboxItem {
            id,
            idempotency_key,
            entity: entity.to_string(),
            method: method.to_string(),
            path: path.to_string(),
            payload_json: payload_json.to_string(),
            status: "pending".to_string(),
            retry_count: 0,
            last_error: None,
            created_at: now,
            next_retry_at: None,
        })
    }

    pub fn list_outbox(&self, status_filter: Option<&str>) -> Result<Vec<OutboxItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = if status_filter.is_some() {
            "SELECT id, idempotency_key, entity, method, path, payload_json, status, retry_count, last_error, created_at, next_retry_at FROM local_outbox WHERE status = ?1 ORDER BY created_at ASC"
        } else {
            "SELECT id, idempotency_key, entity, method, path, payload_json, status, retry_count, last_error, created_at, next_retry_at FROM local_outbox ORDER BY created_at DESC LIMIT 200"
        };
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let mapper = |row: &rusqlite::Row| {
            Ok(OutboxItem {
                id: row.get(0)?,
                idempotency_key: row.get(1)?,
                entity: row.get(2)?,
                method: row.get(3)?,
                path: row.get(4)?,
                payload_json: row.get(5)?,
                status: row.get(6)?,
                retry_count: row.get(7)?,
                last_error: row.get(8)?,
                created_at: row.get(9)?,
                next_retry_at: row.get(10)?,
            })
        };

        let rows = if let Some(st) = status_filter {
            stmt.query_map(params![st], mapper)
        } else {
            stmt.query_map([], mapper)
        }
        .map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        for r in rows {
            items.push(r.map_err(|e| e.to_string())?);
        }
        Ok(items)
    }

    pub fn update_outbox_status(
        &self,
        id: &str,
        status: &str,
        retry_count: i32,
        last_error: Option<&str>,
        next_retry_at: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE local_outbox SET status = ?2, retry_count = ?3, last_error = ?4, next_retry_at = ?5 WHERE id = ?1",
            params![id, status, retry_count, last_error, next_retry_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_offline_auth(
        &self,
        username: &str,
        password_hash: &str,
        user_json: &str,
        menus_json: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO offline_auth (username, password_hash, user_json, menus_json, last_online_login_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, user_json = excluded.user_json, menus_json = excluded.menus_json, last_online_login_at = excluded.last_online_login_at",
            params![username, password_hash, user_json, menus_json, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_offline_auth(&self, username: &str) -> Result<Option<OfflineUserRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT username, password_hash, user_json, menus_json, last_online_login_at FROM offline_auth WHERE username = ?1",
            params![username],
            |row| {
                Ok(OfflineUserRecord {
                    username: row.get(0)?,
                    password_hash: row.get(1)?,
                    user_json: row.get(2)?,
                    menus_json: row.get(3)?,
                    last_online_login_at: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn log_sync(&self, level: &str, entity: &str, message: &str) {
        if let Ok(conn) = self.conn.lock() {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO sync_logs (occurred_at, level, entity, message) VALUES (?1, ?2, ?3, ?4)",
                params![now, level, entity, message],
            );
        }
    }
}
