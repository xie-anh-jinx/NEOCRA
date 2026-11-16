use crate::{
    app::AppState,
    auth::AuthUser,
    utils::{AppError, AppResult, ListQuery, PaginatedResponse},
};
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use percent_encoding::percent_decode_str;
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct GoodsReceiptSummary {
    pub no_penerimaan: String,
    pub tgl_penerimaan: Option<NaiveDate>,
    pub id_supplier: Option<String>,
    pub supplier: Option<String>,
    pub id_gudang: Option<String>,
    pub gudang: Option<String>,
    pub nomor_po: Option<String>,
    pub referensi: Option<String>,
    pub grandtotal: f64,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct GoodsReceiptLineDto {
    pub urut: i32,
    pub id_barang: Option<String>,
    pub nama_barang: Option<String>,
    pub qty: f64,
    pub harga: f64,
    pub total: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct GoodsReceiptDetail {
    #[serde(flatten)]
    pub header: GoodsReceiptSummary,
    pub details: Vec<GoodsReceiptLineDto>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct DeliveryOrderSummary {
    pub nomor: String,
    pub tanggal: Option<NaiveDate>,
    pub id_customer: Option<String>,
    pub customer: Option<String>,
    pub id_gudang: Option<String>,
    pub gudang: Option<String>,
    pub no_pl: Option<String>,
    pub driver: Option<String>,
    pub lic_plate: Option<String>,
    pub status: Option<String>,
    pub received_date: Option<NaiveDate>,
    pub received_name: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct DeliveryOrderLineDto {
    pub urut: i32,
    pub id_barang: Option<String>,
    pub nama_barang: Option<String>,
    pub qty: f64,
    pub qty_diterima: f64,
    pub keterangan: Option<String>,
    pub kemasan: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DeliveryOrderDetail {
    #[serde(flatten)]
    pub header: DeliveryOrderSummary,
    pub details: Vec<DeliveryOrderLineDto>,
}

fn decode_key(raw: &str) -> String {
    percent_decode_str(raw).decode_utf8_lossy().into_owned()
}

async fn list_receipts(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<GoodsReceiptSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM penerimaan a
        LEFT JOIN supplier s ON a.id_supplier = s.id
        WHERE ($1::text IS NULL OR a.no_penerimaan ILIKE $1 OR COALESCE(a.nomor_po,'') ILIKE $1 OR COALESCE(s.supplier,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tgl_penerimaan >= $2)
          AND ($3::date IS NULL OR a.tgl_penerimaan <= $3)
          AND ($4::text IS NULL OR a.id_gudang = $4)
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_gudang)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, GoodsReceiptSummary>(
        r#"
        SELECT a.no_penerimaan,
               a.tgl_penerimaan,
               a.id_supplier,
               s.supplier,
               a.id_gudang,
               g.gudang,
               a.nomor_po,
               a.referensi,
               COALESCE(a.grandtotal, a.total, 0)::float8 AS grandtotal,
               a.status::text AS status
        FROM penerimaan a
        LEFT JOIN supplier s ON a.id_supplier = s.id
        LEFT JOIN gudang g ON a.id_gudang = g.id_gudang
        WHERE ($1::text IS NULL OR a.no_penerimaan ILIKE $1 OR COALESCE(a.nomor_po,'') ILIKE $1 OR COALESCE(s.supplier,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tgl_penerimaan >= $2)
          AND ($3::date IS NULL OR a.tgl_penerimaan <= $3)
          AND ($4::text IS NULL OR a.id_gudang = $4)
        ORDER BY a.tgl_penerimaan DESC NULLS LAST, a.no_penerimaan DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_gudang)
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

async fn get_receipt(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(raw_no): Path<String>,
) -> AppResult<Json<GoodsReceiptDetail>> {
    let no_penerimaan = decode_key(&raw_no);

    let header = sqlx::query_as::<_, GoodsReceiptSummary>(
        r#"
        SELECT a.no_penerimaan,
               a.tgl_penerimaan,
               a.id_supplier,
               s.supplier,
               a.id_gudang,
               g.gudang,
               a.nomor_po,
               a.referensi,
               COALESCE(a.grandtotal, a.total, 0)::float8 AS grandtotal,
               a.status::text AS status
        FROM penerimaan a
        LEFT JOIN supplier s ON a.id_supplier = s.id
        LEFT JOIN gudang g ON a.id_gudang = g.id_gudang
        WHERE a.no_penerimaan = $1
        "#,
    )
    .bind(&no_penerimaan)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Penerimaan '{}' tidak ditemukan", no_penerimaan)))?;

    let details = sqlx::query_as::<_, GoodsReceiptLineDto>(
        r#"
        SELECT d.urut,
               d.id_barang,
               b.nama_barang,
               COALESCE(d.qty, 0)::float8 AS qty,
               COALESCE(d.harga, 0)::float8 AS harga,
               COALESCE(d.total, d.jumlah_harga, 0)::float8 AS total
        FROM penerimaan_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.no_penerimaan = $1
        ORDER BY d.urut
        "#,
    )
    .bind(&no_penerimaan)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(GoodsReceiptDetail { header, details }))
}

async fn list_deliveries(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<DeliveryOrderSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM do_tbl a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        WHERE ($1::text IS NULL OR a.nomor ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1 OR COALESCE(a.no_pl,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_gudang = $4)
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_gudang)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, DeliveryOrderSummary>(
        r#"
        SELECT a.nomor,
               a.tanggal,
               a.id_customer,
               c.customer,
               a.id_gudang,
               g.gudang,
               a.no_pl,
               a.driver,
               a.lic_plate,
               a.status::text AS status,
               a.received_date,
               a.received_name
        FROM do_tbl a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        LEFT JOIN gudang g ON a.id_gudang = g.id_gudang
        WHERE ($1::text IS NULL OR a.nomor ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1 OR COALESCE(a.no_pl,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_gudang = $4)
        ORDER BY a.tanggal DESC NULLS LAST, a.nomor DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_gudang)
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

async fn get_delivery(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(raw_no): Path<String>,
) -> AppResult<Json<DeliveryOrderDetail>> {
    let nomor = decode_key(&raw_no);

    let header = sqlx::query_as::<_, DeliveryOrderSummary>(
        r#"
        SELECT a.nomor,
               a.tanggal,
               a.id_customer,
               c.customer,
               a.id_gudang,
               g.gudang,
               a.no_pl,
               a.driver,
               a.lic_plate,
               a.status::text AS status,
               a.received_date,
               a.received_name
        FROM do_tbl a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        LEFT JOIN gudang g ON a.id_gudang = g.id_gudang
        WHERE a.nomor = $1
        "#,
    )
    .bind(&nomor)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Delivery Order '{}' tidak ditemukan", nomor)))?;

    let details = sqlx::query_as::<_, DeliveryOrderLineDto>(
        r#"
        SELECT d.urut,
               d.id_barang,
               b.nama_barang,
               COALESCE(d.qty, 0)::float8 AS qty,
               COALESCE(d.qty_diterima, 0)::float8 AS qty_diterima,
               d.keterangan,
               d.kemasan
        FROM do_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.no_do = $1
        ORDER BY d.urut
        "#,
    )
    .bind(&nomor)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(DeliveryOrderDetail { header, details }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/receipts", get(list_receipts))
        .route("/receipts/{no_penerimaan}", get(get_receipt))
        .route("/deliveries", get(list_deliveries))
        .route("/deliveries/{nomor}", get(get_delivery))
}
