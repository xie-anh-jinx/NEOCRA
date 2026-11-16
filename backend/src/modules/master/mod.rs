use crate::{
    app::AppState,
    auth::AuthUser,
    services::audit::write_audit_log,
    utils::{f64_to_dec, AppError, AppResult, ListQuery, PaginatedResponse},
};
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct ItemDto {
    pub id_barang: String,
    pub nama_barang: String,
    pub nama_alias: Option<String>,
    pub id_kategori_barang: String,
    pub kategori_barang: Option<String>,
    pub id_satuan_besar: String,
    pub satuan_besar: Option<String>,
    pub id_satuan_kecil: String,
    pub satuan_kecil: Option<String>,
    pub isi_satuan: f64,
    pub id_family: Option<String>,
    pub family: Option<String>,
    pub id_brand: Option<i32>,
    pub brand: Option<String>,
    pub barcode: Option<String>,
    pub berat: Option<f64>,
    pub status: Option<bool>,
    pub keterangan: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertItemRequest {
    pub id_barang: Option<String>,
    pub nama_barang: String,
    pub nama_alias: Option<String>,
    pub id_kategori_barang: String,
    pub id_satuan_besar: String,
    pub id_satuan_kecil: String,
    pub isi_satuan: f64,
    pub id_family: Option<String>,
    pub id_brand: Option<i32>,
    pub barcode: Option<String>,
    pub berat: Option<f64>,
    pub status: Option<bool>,
    pub keterangan: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SupplierDto {
    pub id: String,
    pub supplier: String,
    pub npwp: Option<String>,
    pub telepon: Option<String>,
    pub fax: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub id_kategori_supplier: Option<i32>,
    pub nm_kategori_supplier: Option<String>,
    pub bank: Option<String>,
    pub kena_pajak: Option<bool>,
    pub isaktif: Option<bool>,
    pub top: Option<i32>,
    pub batas_kredit: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertSupplierRequest {
    pub id: Option<String>,
    pub supplier: String,
    pub npwp: Option<String>,
    pub telepon: Option<String>,
    pub fax: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub id_kategori_supplier: Option<i32>,
    pub bank: Option<String>,
    pub kena_pajak: Option<bool>,
    pub isaktif: Option<bool>,
    pub top: Option<i32>,
    pub batas_kredit: Option<i32>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct CustomerDto {
    pub id_kontak: String,
    pub customer: String,
    pub no_npwp: Option<String>,
    pub telepon: Option<String>,
    pub email: Option<String>,
    pub alamat_penagihan: Option<String>,
    pub alamat_kirim: Option<String>,
    pub id_kategori_customer: Option<i32>,
    pub kena_pajak: Option<bool>,
    pub isaktif: Option<bool>,
    pub batas_kredit: Option<f64>,
    pub top: Option<i32>,
    pub id_kantor: Option<String>,
    pub id_sales: Option<String>,
    pub nama_sales: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertCustomerRequest {
    pub id_kontak: Option<String>,
    pub customer: String,
    pub no_npwp: Option<String>,
    pub telepon: Option<String>,
    pub email: Option<String>,
    pub alamat_penagihan: Option<String>,
    pub alamat_kirim: Option<String>,
    pub id_kategori_customer: Option<i32>,
    pub kena_pajak: Option<bool>,
    pub isaktif: Option<bool>,
    pub batas_kredit: Option<f64>,
    pub top: Option<i32>,
    pub id_kantor: Option<String>,
    pub id_sales: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct EmployeeDto {
    pub id_pegawai: String,
    pub nama: String,
    pub nip: Option<String>,
    pub email: Option<String>,
    pub hp: Option<String>,
    pub id_jabatan_new: Option<i32>,
    pub jabatan: Option<String>,
    pub id_departemen_new: Option<i32>,
    pub departemen: Option<String>,
    pub id_kantor_new: Option<String>,
    pub kantor: Option<String>,
    pub status: Option<bool>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SatuanBesarDto {
    pub id_satuan_besar: String,
    pub satuan_besar: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SatuanKecilDto {
    pub id_satuan_kecil: String,
    pub satuan_kecil: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UnitsLookupResponse {
    pub besar: Vec<SatuanBesarDto>,
    pub kecil: Vec<SatuanKecilDto>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct KategoriBarangDto {
    pub id_kategori_barang: String,
    pub kategori_barang: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct BrandDto {
    pub id: i32,
    pub kode_brand: String,
    pub brand: String,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct FamilyDto {
    pub id_family: String,
    pub family: String,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct KategoriSupplierDto {
    pub id_kategori_supplier: i32,
    pub nm_kategori_supplier: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct KategoriCustomerDto {
    pub id_kategori_customer: i32,
    pub nm_kategori_customer: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct CurrencyDto {
    pub kode_mata_uang: String,
    pub mata_uang: Option<String>,
}

async fn list_items(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<ItemDto>>> {
    let search = q.search_pattern();
    let status_bool = q.status.as_deref().and_then(|s| match s {
        "true" | "1" | "active" => Some(true),
        "false" | "0" | "inactive" => Some(false),
        _ => None,
    });

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM barang a
        WHERE ($1::text IS NULL OR a.id_barang ILIKE $1 OR a.nama_barang ILIKE $1 OR COALESCE(a.nama_alias,'') ILIKE $1)
          AND ($2::text IS NULL OR a.id_kategori_barang = $2)
          AND ($3::bool IS NULL OR a.status = $3)
        "#,
    )
    .bind(&search)
    .bind(&q.id_kategori_barang)
    .bind(status_bool)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, ItemDto>(
        r#"
        SELECT a.id_barang, a.nama_barang, a.nama_alias,
               a.id_kategori_barang, k.kategori_barang,
               a.id_satuan_besar, sb.satuan_besar,
               a.id_satuan_kecil, sk.satuan_kecil,
               COALESCE(a.isi_satuan, 1)::float8 AS isi_satuan,
               a.id_family, f.family,
               a.id_brand, br.brand,
               a.barcode,
               a.berat::float8 AS berat,
               a.status, a.keterangan
        FROM barang a
        LEFT JOIN kategori_barang k ON a.id_kategori_barang = k.id_kategori_barang
        LEFT JOIN satuan_besar sb ON a.id_satuan_besar = sb.id_satuan_besar
        LEFT JOIN satuan_kecil sk ON a.id_satuan_kecil = sk.id_satuan_kecil
        LEFT JOIN family f ON a.id_family = f.id_family
        LEFT JOIN brand br ON a.id_brand = br.id
        WHERE ($1::text IS NULL OR a.id_barang ILIKE $1 OR a.nama_barang ILIKE $1 OR COALESCE(a.nama_alias,'') ILIKE $1)
          AND ($2::text IS NULL OR a.id_kategori_barang = $2)
          AND ($3::bool IS NULL OR a.status = $3)
        ORDER BY a.id_barang
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&search)
    .bind(&q.id_kategori_barang)
    .bind(status_bool)
    .bind(q.per_page())
    .bind(q.offset())
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(
        rows,
        q.page(),
        q.per_page(),
        total,
    )))
}

async fn get_item(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id_barang): Path<String>,
) -> AppResult<Json<ItemDto>> {
    let row = sqlx::query_as::<_, ItemDto>(
        r#"
        SELECT a.id_barang, a.nama_barang, a.nama_alias,
               a.id_kategori_barang, k.kategori_barang,
               a.id_satuan_besar, sb.satuan_besar,
               a.id_satuan_kecil, sk.satuan_kecil,
               COALESCE(a.isi_satuan, 1)::float8 AS isi_satuan,
               a.id_family, f.family,
               a.id_brand, br.brand,
               a.barcode,
               a.berat::float8 AS berat,
               a.status, a.keterangan
        FROM barang a
        LEFT JOIN kategori_barang k ON a.id_kategori_barang = k.id_kategori_barang
        LEFT JOIN satuan_besar sb ON a.id_satuan_besar = sb.id_satuan_besar
        LEFT JOIN satuan_kecil sk ON a.id_satuan_kecil = sk.id_satuan_kecil
        LEFT JOIN family f ON a.id_family = f.id_family
        LEFT JOIN brand br ON a.id_brand = br.id
        WHERE a.id_barang = $1
        "#,
    )
    .bind(&id_barang)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Barang '{}' tidak ditemukan", id_barang)))?;

    Ok(Json(row))
}

async fn create_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpsertItemRequest>,
) -> AppResult<Json<ItemDto>> {
    auth.require_role("ROLE_BARANG")?;
    let id_barang = req
        .id_barang
        .clone()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::Validation("id_barang wajib diisi".into()))?;

    sqlx::query(
        r#"
        INSERT INTO barang (
            id_barang, nama_barang, nama_alias, id_kategori_barang,
            id_satuan_besar, id_satuan_kecil, isi_satuan, id_family,
            id_brand, barcode, berat, status, keterangan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        "#,
    )
    .bind(&id_barang)
    .bind(&req.nama_barang)
    .bind(&req.nama_alias)
    .bind(&req.id_kategori_barang)
    .bind(&req.id_satuan_besar)
    .bind(&req.id_satuan_kecil)
    .bind(f64_to_dec(req.isi_satuan))
    .bind(&req.id_family)
    .bind(req.id_brand)
    .bind(&req.barcode)
    .bind(req.berat.map(f64_to_dec))
    .bind(req.status.unwrap_or(true))
    .bind(&req.keterangan)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "master.item.create",
        "barang",
        Some(&id_barang),
        serde_json::json!({ "nama_barang": req.nama_barang }),
    )
    .await;

    get_item(State(state), auth, Path(id_barang)).await
}

async fn update_item(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id_barang): Path<String>,
    Json(req): Json<UpsertItemRequest>,
) -> AppResult<Json<ItemDto>> {
    auth.require_role("ROLE_BARANG")?;

    sqlx::query(
        r#"
        UPDATE barang
        SET nama_barang = $2,
            nama_alias = $3,
            id_kategori_barang = $4,
            id_satuan_besar = $5,
            id_satuan_kecil = $6,
            isi_satuan = $7,
            id_family = $8,
            id_brand = $9,
            barcode = $10,
            berat = $11,
            status = COALESCE($12, status),
            keterangan = $13
        WHERE id_barang = $1
        "#,
    )
    .bind(&id_barang)
    .bind(&req.nama_barang)
    .bind(&req.nama_alias)
    .bind(&req.id_kategori_barang)
    .bind(&req.id_satuan_besar)
    .bind(&req.id_satuan_kecil)
    .bind(f64_to_dec(req.isi_satuan))
    .bind(&req.id_family)
    .bind(req.id_brand)
    .bind(&req.barcode)
    .bind(req.berat.map(f64_to_dec))
    .bind(req.status)
    .bind(&req.keterangan)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "master.item.update",
        "barang",
        Some(&id_barang),
        serde_json::json!({ "nama_barang": req.nama_barang }),
    )
    .await;

    get_item(State(state), auth, Path(id_barang)).await
}

async fn list_suppliers(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<SupplierDto>>> {
    let search = q.search_pattern();
    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM supplier a
        WHERE ($1::text IS NULL OR a.id ILIKE $1 OR a.supplier ILIKE $1 OR COALESCE(a.alamat,'') ILIKE $1)
        "#,
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, SupplierDto>(
        r#"
        SELECT a.id, a.supplier, a.npwp, a.telepon, a.fax, a.email, a.alamat,
               a.id_kategori_supplier, k.nm_kategori_supplier, a.bank,
               a.kena_pajak, a.isaktif, a.top, a.batas_kredit
        FROM supplier a
        LEFT JOIN kategori_supplier k ON a.id_kategori_supplier = k.id_kategori_supplier
        WHERE ($1::text IS NULL OR a.id ILIKE $1 OR a.supplier ILIKE $1 OR COALESCE(a.alamat,'') ILIKE $1)
        ORDER BY a.id
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&search)
    .bind(q.per_page())
    .bind(q.offset())
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(
        rows,
        q.page(),
        q.per_page(),
        total,
    )))
}

async fn get_supplier(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<SupplierDto>> {
    let row = sqlx::query_as::<_, SupplierDto>(
        r#"
        SELECT a.id, a.supplier, a.npwp, a.telepon, a.fax, a.email, a.alamat,
               a.id_kategori_supplier, k.nm_kategori_supplier, a.bank,
               a.kena_pajak, a.isaktif, a.top, a.batas_kredit
        FROM supplier a
        LEFT JOIN kategori_supplier k ON a.id_kategori_supplier = k.id_kategori_supplier
        WHERE a.id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Supplier '{}' tidak ditemukan", id)))?;

    Ok(Json(row))
}

async fn create_supplier(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpsertSupplierRequest>,
) -> AppResult<Json<SupplierDto>> {
    auth.require_role("ROLE_SUPPLIER")?;
    let id = req
        .id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::Validation("id supplier wajib diisi".into()))?;

    sqlx::query(
        r#"
        INSERT INTO supplier (
            id, supplier, npwp, telepon, fax, email, alamat,
            id_kategori_supplier, bank, kena_pajak, isaktif, top, batas_kredit,
            user_input, input_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        "#,
    )
    .bind(&id)
    .bind(&req.supplier)
    .bind(&req.npwp)
    .bind(&req.telepon)
    .bind(&req.fax)
    .bind(&req.email)
    .bind(&req.alamat)
    .bind(req.id_kategori_supplier)
    .bind(&req.bank)
    .bind(req.kena_pajak.unwrap_or(true))
    .bind(req.isaktif.unwrap_or(true))
    .bind(req.top.unwrap_or(30))
    .bind(req.batas_kredit.unwrap_or(0))
    .bind(&auth.id_pegawai)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "master.supplier.create",
        "supplier",
        Some(&id),
        serde_json::json!({ "supplier": req.supplier }),
    )
    .await;

    get_supplier(State(state), auth, Path(id)).await
}

async fn update_supplier(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(req): Json<UpsertSupplierRequest>,
) -> AppResult<Json<SupplierDto>> {
    auth.require_role("ROLE_SUPPLIER")?;

    sqlx::query(
        r#"
        UPDATE supplier
        SET supplier = $2, npwp = $3, telepon = $4, fax = $5, email = $6,
            alamat = $7, id_kategori_supplier = $8, bank = $9,
            kena_pajak = COALESCE($10, kena_pajak),
            isaktif = COALESCE($11, isaktif),
            top = COALESCE($12, top),
            batas_kredit = COALESCE($13, batas_kredit),
            user_update = $14, last_update = NOW()
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .bind(&req.supplier)
    .bind(&req.npwp)
    .bind(&req.telepon)
    .bind(&req.fax)
    .bind(&req.email)
    .bind(&req.alamat)
    .bind(req.id_kategori_supplier)
    .bind(&req.bank)
    .bind(req.kena_pajak)
    .bind(req.isaktif)
    .bind(req.top)
    .bind(req.batas_kredit)
    .bind(&auth.id_pegawai)
    .execute(&state.pool)
    .await?;

    get_supplier(State(state), auth, Path(id)).await
}

async fn list_customers(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<CustomerDto>>> {
    let search = q.search_pattern();
    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM customer a
        WHERE ($1::text IS NULL OR a.id_kontak ILIKE $1 OR a.customer ILIKE $1 OR COALESCE(a.alamat_penagihan,'') ILIKE $1)
        "#,
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, CustomerDto>(
        r#"
        SELECT a.id_kontak, a.customer, a.no_npwp, a.telepon, a.email,
               a.alamat_penagihan, a.alamat_kirim, a.id_kategori_customer,
               a.kena_pajak, a.isaktif,
               a.batas_kredit::float8 AS batas_kredit,
               a.top, a.id_kantor, a.id_sales, p.nama AS nama_sales
        FROM customer a
        LEFT JOIN pegawai p ON a.id_sales = p.id_pegawai
        WHERE ($1::text IS NULL OR a.id_kontak ILIKE $1 OR a.customer ILIKE $1 OR COALESCE(a.alamat_penagihan,'') ILIKE $1)
        ORDER BY a.id_kontak
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&search)
    .bind(q.per_page())
    .bind(q.offset())
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(
        rows,
        q.page(),
        q.per_page(),
        total,
    )))
}

async fn get_customer(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id_kontak): Path<String>,
) -> AppResult<Json<CustomerDto>> {
    let row = sqlx::query_as::<_, CustomerDto>(
        r#"
        SELECT a.id_kontak, a.customer, a.no_npwp, a.telepon, a.email,
               a.alamat_penagihan, a.alamat_kirim, a.id_kategori_customer,
               a.kena_pajak, a.isaktif,
               a.batas_kredit::float8 AS batas_kredit,
               a.top, a.id_kantor, a.id_sales, p.nama AS nama_sales
        FROM customer a
        LEFT JOIN pegawai p ON a.id_sales = p.id_pegawai
        WHERE a.id_kontak = $1
        "#,
    )
    .bind(&id_kontak)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Customer '{}' tidak ditemukan", id_kontak)))?;

    Ok(Json(row))
}

async fn create_customer(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpsertCustomerRequest>,
) -> AppResult<Json<CustomerDto>> {
    auth.require_role("ROLE_CUSTOMER")?;
    let id_kontak = req
        .id_kontak
        .clone()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::Validation("id_kontak wajib diisi".into()))?;

    sqlx::query(
        r#"
        INSERT INTO customer (
            id_kontak, customer, no_npwp, telepon, email,
            alamat_penagihan, alamat_kirim, id_kategori_customer,
            kena_pajak, isaktif, batas_kredit, top, id_kantor, id_sales
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        "#,
    )
    .bind(&id_kontak)
    .bind(&req.customer)
    .bind(&req.no_npwp)
    .bind(&req.telepon)
    .bind(&req.email)
    .bind(&req.alamat_penagihan)
    .bind(&req.alamat_kirim)
    .bind(req.id_kategori_customer)
    .bind(req.kena_pajak.unwrap_or(true))
    .bind(req.isaktif.unwrap_or(true))
    .bind(req.batas_kredit.map(f64_to_dec))
    .bind(req.top.unwrap_or(30))
    .bind(&req.id_kantor)
    .bind(&req.id_sales)
    .execute(&state.pool)
    .await?;

    get_customer(State(state), auth, Path(id_kontak)).await
}

async fn update_customer(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id_kontak): Path<String>,
    Json(req): Json<UpsertCustomerRequest>,
) -> AppResult<Json<CustomerDto>> {
    auth.require_role("ROLE_CUSTOMER")?;

    sqlx::query(
        r#"
        UPDATE customer
        SET customer = $2, no_npwp = $3, telepon = $4, email = $5,
            alamat_penagihan = $6, alamat_kirim = $7, id_kategori_customer = $8,
            kena_pajak = COALESCE($9, kena_pajak),
            isaktif = COALESCE($10, isaktif),
            batas_kredit = COALESCE($11, batas_kredit),
            top = COALESCE($12, top),
            id_kantor = $13, id_sales = $14
        WHERE id_kontak = $1
        "#,
    )
    .bind(&id_kontak)
    .bind(&req.customer)
    .bind(&req.no_npwp)
    .bind(&req.telepon)
    .bind(&req.email)
    .bind(&req.alamat_penagihan)
    .bind(&req.alamat_kirim)
    .bind(req.id_kategori_customer)
    .bind(req.kena_pajak)
    .bind(req.isaktif)
    .bind(req.batas_kredit.map(f64_to_dec))
    .bind(req.top)
    .bind(&req.id_kantor)
    .bind(&req.id_sales)
    .execute(&state.pool)
    .await?;

    get_customer(State(state), auth, Path(id_kontak)).await
}

async fn list_employees(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<EmployeeDto>>> {
    let search = q.search_pattern();
    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM pegawai p
        WHERE ($1::text IS NULL OR p.id_pegawai ILIKE $1 OR p.nama ILIKE $1 OR COALESCE(p.nip,'') ILIKE $1)
        "#,
    )
    .bind(&search)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, EmployeeDto>(
        r#"
        SELECT p.id_pegawai, p.nama, p.nip, p.email, p.hp,
               p.id_jabatan_new, j.jabatan,
               p.id_departemen_new, d.departemen,
               p.id_kantor_new, k.nama AS kantor,
               p.status
        FROM pegawai p
        LEFT JOIN master_jabatan j ON p.id_jabatan_new = j.id_jabatan
        LEFT JOIN hr_departemen d ON p.id_departemen_new = d.id_departemen
        LEFT JOIN internal_kantor_cabang k ON p.id_kantor_new = k.id_kantor_cabang
        WHERE ($1::text IS NULL OR p.id_pegawai ILIKE $1 OR p.nama ILIKE $1 OR COALESCE(p.nip,'') ILIKE $1)
        ORDER BY p.id_pegawai
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(&search)
    .bind(q.per_page())
    .bind(q.offset())
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PaginatedResponse::new(
        rows,
        q.page(),
        q.per_page(),
        total,
    )))
}

async fn get_employee(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id_pegawai): Path<String>,
) -> AppResult<Json<EmployeeDto>> {
    let row = sqlx::query_as::<_, EmployeeDto>(
        r#"
        SELECT p.id_pegawai, p.nama, p.nip, p.email, p.hp,
               p.id_jabatan_new, j.jabatan,
               p.id_departemen_new, d.departemen,
               p.id_kantor_new, k.nama AS kantor,
               p.status
        FROM pegawai p
        LEFT JOIN master_jabatan j ON p.id_jabatan_new = j.id_jabatan
        LEFT JOIN hr_departemen d ON p.id_departemen_new = d.id_departemen
        LEFT JOIN internal_kantor_cabang k ON p.id_kantor_new = k.id_kantor_cabang
        WHERE p.id_pegawai = $1
        "#,
    )
    .bind(&id_pegawai)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Pegawai '{}' tidak ditemukan", id_pegawai)))?;

    Ok(Json(row))
}

async fn lookup_units(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<UnitsLookupResponse>> {
    let besar = sqlx::query_as::<_, SatuanBesarDto>(
        "SELECT id_satuan_besar, satuan_besar FROM satuan_besar ORDER BY id_satuan_besar",
    )
    .fetch_all(&state.pool)
    .await?;

    let kecil = sqlx::query_as::<_, SatuanKecilDto>(
        "SELECT id_satuan_kecil, satuan_kecil FROM satuan_kecil ORDER BY id_satuan_kecil",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(UnitsLookupResponse { besar, kecil }))
}

async fn lookup_categories(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<KategoriBarangDto>>> {
    let rows = sqlx::query_as::<_, KategoriBarangDto>(
        "SELECT id_kategori_barang, kategori_barang FROM kategori_barang ORDER BY id_kategori_barang",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn lookup_brands(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<BrandDto>>> {
    let rows = sqlx::query_as::<_, BrandDto>("SELECT id, kode_brand, brand FROM brand ORDER BY id")
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows))
}

async fn lookup_families(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<FamilyDto>>> {
    let rows =
        sqlx::query_as::<_, FamilyDto>("SELECT id_family, family FROM family ORDER BY id_family")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(rows))
}

async fn lookup_supplier_categories(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<KategoriSupplierDto>>> {
    let rows = sqlx::query_as::<_, KategoriSupplierDto>(
        "SELECT id_kategori_supplier, nm_kategori_supplier FROM kategori_supplier ORDER BY id_kategori_supplier",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn lookup_customer_categories(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<KategoriCustomerDto>>> {
    let rows = sqlx::query_as::<_, KategoriCustomerDto>(
        "SELECT id_kategori_customer, nm_kategori_customer FROM kategori_customer ORDER BY id_kategori_customer",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn lookup_currencies(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<CurrencyDto>>> {
    let rows = sqlx::query_as::<_, CurrencyDto>(
        "SELECT kode_mata_uang, mata_uang FROM mata_uang ORDER BY kode_mata_uang",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/items", get(list_items).post(create_item))
        .route("/items/{id_barang}", get(get_item).put(update_item))
        .route("/suppliers", get(list_suppliers).post(create_supplier))
        .route("/suppliers/{id}", get(get_supplier).put(update_supplier))
        .route("/customers", get(list_customers).post(create_customer))
        .route(
            "/customers/{id_kontak}",
            get(get_customer).put(update_customer),
        )
        .route("/employees", get(list_employees))
        .route("/employees/{id_pegawai}", get(get_employee))
        .route("/units", get(lookup_units))
        .route("/categories", get(lookup_categories))
        .route("/brands", get(lookup_brands))
        .route("/families", get(lookup_families))
        .route("/supplier-categories", get(lookup_supplier_categories))
        .route("/customer-categories", get(lookup_customer_categories))
        .route("/currencies", get(lookup_currencies))
}
