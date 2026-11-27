use argon2::{
    password_hash::{
        rand_core::{OsRng, RngCore},
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2,
};
use std::fs;
use std::path::PathBuf;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const SERVICE_NAME: &str = "com.cra.neocra.desktop";

pub fn get_or_create_db_key(app_dir: &PathBuf) -> String {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Ok(entry) = keyring::Entry::new(SERVICE_NAME, "sqlcipher_db_key") {
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
    }

    // Android/iOS sandboxed private app storage (or headless desktop fallback)
    let _ = fs::create_dir_all(app_dir);
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

pub fn store_token(app_dir: &PathBuf, username: &str, token: &str) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Ok(entry) = keyring::Entry::new(SERVICE_NAME, &format!("token_{}", username)) {
            if entry.set_password(token).is_ok() {
                return;
            }
        }
    }
    let tokens_dir = app_dir.join(".tokens");
    let _ = fs::create_dir_all(&tokens_dir);
    let _ = fs::write(tokens_dir.join(sanitize_key(username)), token);
}

pub fn load_token(app_dir: &PathBuf, username: &str) -> Option<String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(pw) = keyring::Entry::new(SERVICE_NAME, &format!("token_{}", username))
            .ok()
            .and_then(|e| e.get_password().ok())
        {
            return Some(pw);
        }
    }
    fs::read_to_string(app_dir.join(".tokens").join(sanitize_key(username)))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn clear_token(app_dir: &PathBuf, username: &str) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Ok(entry) = keyring::Entry::new(SERVICE_NAME, &format!("token_{}", username)) {
            let _ = entry.delete_credential();
        }
    }
    let _ = fs::remove_file(app_dir.join(".tokens").join(sanitize_key(username)));
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

fn sanitize_key(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect()
}

fn generate_random_hex(bytes_len: usize) -> String {
    let mut buf = vec![0u8; bytes_len];
    OsRng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{:02x}", b)).collect()
}
