use crate::{
    app::AppState,
    services::audit::write_audit_log,
    utils::{AppError, AppResult},
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{FromRequestParts, State},
    http::{header::AUTHORIZATION, request::Parts},
    routing::{delete, get, post},
    Json, Router,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub id_pegawai: String,
    pub is_superadmin: bool,
    pub roles: Vec<String>,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub username: String,
    pub id_pegawai: String,
    pub is_superadmin: bool,
    pub roles: Vec<String>,
}

impl AuthUser {
    pub fn require_role(&self, role: &str) -> AppResult<()> {
        if self.is_superadmin || self.roles.iter().any(|r| r == role || r == "ROLE_ADMIN") {
            Ok(())
        } else {
            Err(AppError::Forbidden(format!(
                "Missing required permission role: {}",
                role
            )))
        }
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing Authorization Bearer token".into()))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .or_else(|| auth_header.strip_prefix("bearer "))
            .ok_or_else(|| AppError::Unauthorized("Invalid Authorization header format".into()))?;

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| AppError::Unauthorized("Invalid or expired JWT token".into()))?;

        Ok(AuthUser {
            username: token_data.claims.sub,
            id_pegawai: token_data.claims.id_pegawai,
            is_superadmin: token_data.claims.is_superadmin,
            roles: token_data.claims.roles,
        })
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserProfile {
    pub username: String,
    pub nama: String,
    pub id_pegawai: String,
    pub is_superadmin: bool,
    pub roles: Vec<String>,
    pub jabatan: Option<String>,
    pub id_jabatan: Option<i32>,
    pub departemen: Option<String>,
    pub id_departemen: Option<i32>,
    pub id_kantor: Option<String>,
    pub kantor: Option<String>,
    pub branches: Vec<String>,
    pub warehouses: Vec<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LoginResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub expires_in: u64,
    pub user: UserProfile,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MenuNode {
    pub id: i32,
    pub name: String,
    pub icon: Option<String>,
    pub outcome: Option<String>,
    pub urut: Option<i32>,
    pub roles: Option<String>,
    #[schema(no_recursion)]
    pub children: Vec<MenuNode>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, FromRow)]
struct PenggunaAuthRow {
    usernamenya: String,
    passwordnya: String,
    nama: String,
    id_pegawai: String,
    enabled: Option<bool>,
    roles: Option<String>,
}

#[derive(Debug, FromRow)]
struct PegawaiProfileRow {
    id_jabatan_new: Option<i32>,
    jabatan: Option<String>,
    id_departemen_new: Option<i32>,
    departemen: Option<String>,
    id_kantor_new: Option<String>,
    kantor: Option<String>,
}

#[derive(Debug, FromRow, Clone)]
struct MenuRow {
    id: i32,
    name: String,
    icon: Option<String>,
    outcome: Option<String>,
    urut: Option<i32>,
    parent: Option<i32>,
    roles: Option<String>,
}

fn md5_hex(input: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_argon2(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("Argon2 hashing error: {}", e)))
}

fn verify_argon2(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .map(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

async fn verify_and_upgrade_password(
    pool: &PgPool,
    username: &str,
    plain_password: &str,
    legacy_md5: &str,
) -> AppResult<bool> {
    let existing_argon: Option<String> = sqlx::query_scalar(
        "SELECT password_hash FROM neocra.user_credentials WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;

    if let Some(hash) = existing_argon {
        if verify_argon2(plain_password, &hash) {
            return Ok(true);
        }
        // Fallback if legacy password was updated directly in DB
        if md5_hex(plain_password).eq_ignore_ascii_case(legacy_md5) {
            if let Ok(new_hash) = hash_argon2(plain_password) {
                let _ = sqlx::query(
                    "UPDATE neocra.user_credentials SET password_hash = $2, updated_at = NOW() WHERE username = $1",
                )
                .bind(username)
                .bind(new_hash)
                .execute(pool)
                .await;
            }
            return Ok(true);
        }
        return Ok(false);
    }

    if md5_hex(plain_password).eq_ignore_ascii_case(legacy_md5) {
        if let Ok(argon_hash) = hash_argon2(plain_password) {
            let _ = sqlx::query(
                r#"
                INSERT INTO neocra.user_credentials (username, password_hash, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
                "#,
            )
            .bind(username)
            .bind(argon_hash)
            .execute(pool)
            .await;
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn load_user_profile(pool: &PgPool, username: &str) -> AppResult<UserProfile> {
    let row = sqlx::query_as::<_, PenggunaAuthRow>(
        "SELECT usernamenya, passwordnya, nama, id_pegawai, enabled, roles FROM pengguna WHERE usernamenya = $1",
    )
    .bind(username)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("User '{}' not found", username)))?;

    let mut roles: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT c.roles
        FROM hakakses b
        INNER JOIN menu c ON b.id_menu = c.id
        WHERE b.usernamenya = $1 AND c.roles IS NOT NULL AND c.roles <> ''
        ORDER BY c.roles
        "#,
    )
    .bind(username)
    .fetch_all(pool)
    .await?;

    let is_superadmin = row.roles.as_deref() == Some("ROLE_ADMIN")
        || roles.iter().any(|r| r == "ROLE_ADMIN")
        || username == "superadmin";

    if is_superadmin && !roles.iter().any(|r| r == "ROLE_ADMIN") {
        roles.push("ROLE_ADMIN".to_string());
    }

    let peg = sqlx::query_as::<_, PegawaiProfileRow>(
        r#"
        SELECT p.id_jabatan_new, j.jabatan, p.id_departemen_new, d.departemen,
               p.id_kantor_new, k.nama AS kantor
        FROM pegawai p
        LEFT JOIN master_jabatan j ON p.id_jabatan_new = j.id_jabatan
        LEFT JOIN hr_departemen d ON p.id_departemen_new = d.id_departemen
        LEFT JOIN internal_kantor_cabang k ON p.id_kantor_new = k.id_kantor_cabang
        WHERE p.id_pegawai = $1
        "#,
    )
    .bind(&row.id_pegawai)
    .fetch_optional(pool)
    .await?;

    let branches: Vec<String> = sqlx::query_scalar(
        "SELECT id_kantor_cabang FROM map_pengguna_cabang WHERE usernamenya = $1 ORDER BY id_kantor_cabang",
    )
    .bind(username)
    .fetch_all(pool)
    .await?;

    let warehouses: Vec<String> = sqlx::query_scalar(
        "SELECT id_gudang FROM map_pengguna_gudang WHERE usernamenya = $1 ORDER BY id_gudang",
    )
    .bind(username)
    .fetch_all(pool)
    .await?;

    let avatar_url: Option<String> = sqlx::query_scalar(
        "SELECT avatar_data FROM neocra.user_avatars WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    Ok(UserProfile {
        username: row.usernamenya,
        nama: row.nama,
        id_pegawai: row.id_pegawai,
        is_superadmin,
        roles,
        jabatan: peg.as_ref().and_then(|p| p.jabatan.clone()),
        id_jabatan: peg.as_ref().and_then(|p| p.id_jabatan_new),
        departemen: peg.as_ref().and_then(|p| p.departemen.clone()),
        id_departemen: peg.as_ref().and_then(|p| p.id_departemen_new),
        id_kantor: peg.as_ref().and_then(|p| p.id_kantor_new.clone()),
        kantor: peg.as_ref().and_then(|p| p.kantor.clone()),
        branches,
        warehouses,
        avatar_url,
    })
}

#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Authenticated successfully", body = LoginResponse),
        (status = 401, description = "Invalid credentials")
    ),
    tag = "Auth"
)]
pub async fn login_handler(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    let username = req.username.trim();
    let row = sqlx::query_as::<_, PenggunaAuthRow>(
        "SELECT usernamenya, passwordnya, nama, id_pegawai, enabled, roles FROM pengguna WHERE usernamenya = $1",
    )
    .bind(username)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Username atau password salah".into()))?;

    if !row.enabled.unwrap_or(false) {
        return Err(AppError::Unauthorized("Akun pengguna tidak aktif".into()));
    }

    let valid = verify_and_upgrade_password(&state.pool, username, &req.password, &row.passwordnya).await?;
    if !valid {
        return Err(AppError::Unauthorized("Username atau password salah".into()));
    }

    // Legacy login timestamp update (matches MapperPengguna updateLastLogin + updateNewLogin)
    let _ = sqlx::query(
        "UPDATE pengguna SET loginterkahir = loginterbaru, loginterbaru = NOW(), jmlogin = COALESCE(jmlogin, 0) + 1 WHERE usernamenya = $1",
    )
    .bind(username)
    .execute(&state.pool)
    .await;

    let user = load_user_profile(&state.pool, username).await?;
    let exp = chrono::Utc::now().timestamp() as usize + state.config.jwt_expires_in_seconds as usize;
    let claims = Claims {
        sub: user.username.clone(),
        id_pegawai: user.id_pegawai.clone(),
        is_superadmin: user.is_superadmin,
        roles: user.roles.clone(),
        exp,
    };

    let access_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("JWT encoding error: {}", e)))?;

    write_audit_log(
        &state.pool,
        Some(&user.username),
        "auth.login",
        "pengguna",
        Some(&user.username),
        serde_json::json!({ "id_pegawai": user.id_pegawai }),
    )
    .await;

    Ok(Json(LoginResponse {
        access_token,
        token_type: "Bearer",
        expires_in: state.config.jwt_expires_in_seconds,
        user,
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/auth/me",
    responses((status = 200, body = UserProfile)),
    tag = "Auth"
)]
pub async fn me_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<UserProfile>> {
    let profile = load_user_profile(&state.pool, &auth.username).await?;
    Ok(Json(profile))
}

#[utoipa::path(
    get,
    path = "/api/v1/auth/menus",
    responses((status = 200, body = Vec<MenuNode>)),
    tag = "Auth"
)]
pub async fn menus_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<MenuNode>>> {
    let rows = if auth.username == "superadmin" {
        sqlx::query_as::<_, MenuRow>(
            r#"
            SELECT id, name, icon, outcome, urut, parent, roles
            FROM menu
            ORDER BY COALESCE(urut, 9999), id
            "#,
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, MenuRow>(
            r#"
            SELECT a.id, a.name, a.icon, a.outcome, a.urut, a.parent, a.roles
            FROM menu a
            INNER JOIN hakakses b ON a.id = b.id_menu
            WHERE b.usernamenya = $1
            ORDER BY COALESCE(a.urut, 9999), a.id
            "#,
        )
        .bind(&auth.username)
        .fetch_all(&state.pool)
        .await?
    };

    let mut children_map: HashMap<i32, Vec<MenuRow>> = HashMap::new();
    let mut roots: Vec<MenuRow> = Vec::new();

    for r in rows {
        if let Some(p) = r.parent {
            children_map.entry(p).or_default().push(r);
        } else {
            roots.push(r);
        }
    }

    fn build_node(row: MenuRow, map: &HashMap<i32, Vec<MenuRow>>) -> MenuNode {
        let children = map
            .get(&row.id)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|c| build_node(c, map))
            .collect();
        MenuNode {
            id: row.id,
            name: row.name,
            icon: row.icon,
            outcome: row.outcome,
            urut: row.urut,
            roles: row.roles,
            children,
        }
    }

    let tree = roots.into_iter().map(|r| build_node(r, &children_map)).collect();
    Ok(Json(tree))
}

#[utoipa::path(
    post,
    path = "/api/v1/auth/change-password",
    request_body = ChangePasswordRequest,
    responses((status = 200, body = OkResponse)),
    tag = "Auth"
)]
pub async fn change_password_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<ChangePasswordRequest>,
) -> AppResult<Json<OkResponse>> {
    if req.new_password.trim().len() < 6 {
        return Err(AppError::Validation(
            "Password baru minimal 6 karakter".into(),
        ));
    }

    let row = sqlx::query_as::<_, PenggunaAuthRow>(
        "SELECT usernamenya, passwordnya, nama, id_pegawai, enabled, roles FROM pengguna WHERE usernamenya = $1",
    )
    .bind(&auth.username)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User tidak ditemukan".into()))?;

    let valid = verify_and_upgrade_password(&state.pool, &auth.username, &req.old_password, &row.passwordnya).await?;
    if !valid {
        return Err(AppError::Unauthorized("Password lama tidak sesuai".into()));
    }

    let argon_hash = hash_argon2(&req.new_password)?;
    let md5_new = md5_hex(&req.new_password);

    sqlx::query(
        r#"
        INSERT INTO neocra.user_credentials (username, password_hash, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
        "#,
    )
    .bind(&auth.username)
    .bind(&argon_hash)
    .execute(&state.pool)
    .await?;

    // Maintain legacy MD5 in pengguna.passwordnya so old CRA keeps working
    sqlx::query("UPDATE pengguna SET passwordnya = $2 WHERE usernamenya = $1")
        .bind(&auth.username)
        .bind(&md5_new)
        .execute(&state.pool)
        .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "auth.change_password",
        "pengguna",
        Some(&auth.username),
        serde_json::json!({}),
    )
    .await;

    Ok(Json(OkResponse { ok: true }))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateAvatarRequest {
    pub avatar_data: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AvatarResponse {
    pub avatar_url: Option<String>,
}

pub async fn upload_avatar_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpdateAvatarRequest>,
) -> AppResult<Json<AvatarResponse>> {
    let data = req.avatar_data.trim();
    if !data.starts_with("data:image/") {
        return Err(AppError::Validation(
            "Format foto harus berupa gambar (PNG/JPG/WEBP)".into(),
        ));
    }
    if data.len() > 3_000_000 {
        return Err(AppError::Validation(
            "Ukuran foto maksimal 2MB".into(),
        ));
    }

    sqlx::query(
        r#"
        INSERT INTO neocra.user_avatars (username, avatar_data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (username) DO UPDATE SET avatar_data = EXCLUDED.avatar_data, updated_at = NOW()
        "#,
    )
    .bind(&auth.username)
    .bind(data)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "auth.upload_avatar",
        "pengguna",
        Some(&auth.username),
        serde_json::json!({}),
    )
    .await;

    Ok(Json(AvatarResponse {
        avatar_url: Some(data.to_string()),
    }))
}

pub async fn delete_avatar_handler(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<AvatarResponse>> {
    sqlx::query("DELETE FROM neocra.user_avatars WHERE username = $1")
        .bind(&auth.username)
        .execute(&state.pool)
        .await?;

    Ok(Json(AvatarResponse { avatar_url: None }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login_handler))
        .route("/me", get(me_handler))
        .route("/menus", get(menus_handler))
        .route("/avatar", post(upload_avatar_handler).delete(delete_avatar_handler))
        .route("/change-password", post(change_password_handler))
}
