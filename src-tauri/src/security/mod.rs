use argon2::{
    password_hash::{
        rand_core::{OsRng, RngCore},
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2,
};
use keyring::Entry;
use std::fs;
use std::path::PathBuf;

const SERVICE_NAME: &str = "com.cra.neocra.desktop";

pub fn get_or_create_db_key(app_dir: &PathBuf) -> String {
    if let Ok(entry) = Entry::new(SERVICE_NAME, "sqlcipher_db_key") {
        if let Ok(pw) = entry.get_password() {
            if !pw.is_empty() {
                return pw;
            }
        }
        let key = generate_random_hex(32);
        if entry.set_password(&key).is_ok() {
            return key;
        }
    }

    // Fallback local key file when OS keyring daemon is unavailable (e.g. headless CI)
    let fallback_path = app_dir.join(".db_key");
    if let Ok(existing) = fs::read_to_string(&fallback_path) {
        if !existing.trim().is_empty() {
            return existing.trim().to_string();
        }
    }
    let key = generate_random_hex(32);
    let _ = fs::write(&fallback_path, &key);
    key
}

pub fn store_token(username: &str, token: &str) {
    if let Ok(entry) = Entry::new(SERVICE_NAME, &format!("token_{}", username)) {
        let _ = entry.set_password(token);
    }
}

pub fn load_token(username: &str) -> Option<String> {
    Entry::new(SERVICE_NAME, &format!("token_{}", username))
        .ok()
        .and_then(|e| e.get_password().ok())
}

pub fn clear_token(username: &str) {
    if let Ok(entry) = Entry::new(SERVICE_NAME, &format!("token_{}", username)) {
        let _ = entry.delete_credential();
    }
}

pub fn hash_offline_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

pub fn verify_offline_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .map(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

fn generate_random_hex(bytes_len: usize) -> String {
    let mut buf = vec![0u8; bytes_len];
    OsRng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{:02x}", b)).collect()
}
