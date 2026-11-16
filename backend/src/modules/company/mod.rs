use crate::{
    app::AppState,
    auth::AuthUser,
    utils::{AppError, AppResult, ListQuery},
};
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct CompanyProfile {
    pub id_perusahaan: String,
    pub nama: Option<String>,
    pub inisial: Option<String>,
    pub logo: Option<String>,
    pub akun_ppn_masukan: Option<i32>,
    pub akun_pph: Option<i32>,
    pub akun_pembelian: Option<i32>,
    pub akun_ppn_keluaran: Option<i32>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct BranchItem {
    pub id_kantor_cabang: String,
    pub id_perusahaan: Option<String>,
    pub nama: Option<String>,
    pub ho: Option<bool>,
    pub alamat: Option<String>,
    pub telpon: Option<String>,
    pub kontak: Option<String>,
    pub email: Option<String>,
    pub aktif: Option<bool>,
    pub numbercode: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct WarehouseItem {
    pub id_gudang: String,
    pub gudang: String,
    pub id_kantor: Option<String>,
    pub alamat: Option<String>,
    pub telpon: Option<String>,
    pub inisial: Option<String>,
    pub parent: Option<String>,
    pub shipto: Option<String>,
    pub blind: bool,
    pub stokopname: bool,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct DepartmentItem {
    pub id_departemen: i32,
    pub departemen: String,
    pub id_perusahaan: Option<String>,
    pub roles: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct PositionItem {
    pub id_jabatan: i32,
    pub jabatan: String,
    pub jabatan_alias: Option<String>,
    pub atasan: Option<i32>,
    pub id_departemen: Option<i32>,
    pub headdepartemen: Option<bool>,
}

async fn get_profile(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<CompanyProfile>> {
    let row = sqlx::query_as::<_, CompanyProfile>(
        r#"
        SELECT id_perusahaan, nama, inisial, logo,
               akun_ppn_masukan, akun_pph, akun_pembelian, akun_ppn_keluaran
        FROM internal_perusahaan
        ORDER BY id_perusahaan
        LIMIT 1
        "#,
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Company profile not found".into()))?;

    Ok(Json(row))
}

async fn list_branches(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<BranchItem>>> {
    let rows = sqlx::query_as::<_, BranchItem>(
        r#"
        SELECT id_kantor_cabang, id_perusahaan, nama, ho, alamat,
               telpon, kontak, email, aktif, numbercode
        FROM internal_kantor_cabang
        ORDER BY id_kantor_cabang
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

async fn list_warehouses(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<WarehouseItem>>> {
    let rows = sqlx::query_as::<_, WarehouseItem>(
        r#"
        SELECT id_gudang, gudang, id_kantor, alamat, telpon,
               inisial, parent, shipto, blind, stokopname
        FROM gudang
        WHERE ($1::text IS NULL OR id_kantor = $1)
        ORDER BY id_gudang
        "#,
    )
    .bind(&q.id_kantor)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

async fn list_departments(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<DepartmentItem>>> {
    let rows = sqlx::query_as::<_, DepartmentItem>(
        "SELECT id_departemen, departemen, id_perusahaan, roles FROM hr_departemen ORDER BY id_departemen",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

async fn list_positions(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<PositionItem>>> {
    let rows = sqlx::query_as::<_, PositionItem>(
        "SELECT id_jabatan, jabatan, jabatan_alias, atasan, id_departemen, headdepartemen FROM master_jabatan ORDER BY id_jabatan",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/profile", get(get_profile))
        .route("/branches", get(list_branches))
        .route("/warehouses", get(list_warehouses))
        .route("/departments", get(list_departments))
        .route("/positions", get(list_positions))
}
