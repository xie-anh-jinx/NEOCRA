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
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct StockRow {
    pub id_gudang: String,
    pub gudang: Option<String>,
    pub id_barang: String,
    pub nama_barang: Option<String>,
    pub satuan: Option<String>,
    pub qty: f64,
    pub nilai: f64,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct WarehouseStockItem {
    pub id_gudang: String,
    pub gudang: Option<String>,
    pub qty: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ItemStockDetail {
    pub id_barang: String,
    pub nama_barang: String,
    pub total_qty: f64,
    pub warehouses: Vec<WarehouseStockItem>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct StockCardMovement {
    pub id_stok: f64,
    pub tanggal: NaiveDate,
    pub id_gudang: String,
    pub id_barang: String,
    pub reff: Option<String>,
    pub persediaan: f64,
    pub stok: f64,
    pub hpp: f64,
    pub batch: Option<String>,
}

async fn list_stock(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<StockRow>>> {
    let search = q.search_pattern();
    let only_avail = q.only_available.unwrap_or(true);

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM (
            SELECT s.id_gudang, s.id_barang
            FROM stok_barang s
            INNER JOIN barang b ON s.id_barang = b.id_barang
            WHERE ($1::text IS NULL OR s.id_gudang = $1)
              AND ($2::text IS NULL OR s.id_barang ILIKE $2 OR b.nama_barang ILIKE $2)
            GROUP BY s.id_gudang, s.id_barang
            HAVING (NOT $3 OR SUM(s.stok) > 0)
        ) sub
        "#,
    )
    .bind(&q.id_gudang)
    .bind(&search)
    .bind(only_avail)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, StockRow>(
        r#"
        SELECT s.id_gudang,
               g.gudang,
               s.id_barang,
               b.nama_barang,
               sk.satuan_kecil AS satuan,
               COALESCE(SUM(s.stok), 0)::float8 AS qty,
               COALESCE(SUM(s.stok * COALESCE(s.hpp, 0)), 0)::float8 AS nilai
        FROM stok_barang s
        INNER JOIN barang b ON s.id_barang = b.id_barang
        LEFT JOIN gudang g ON s.id_gudang = g.id_gudang
        LEFT JOIN satuan_kecil sk ON b.id_satuan_kecil = sk.id_satuan_kecil
        WHERE ($1::text IS NULL OR s.id_gudang = $1)
          AND ($2::text IS NULL OR s.id_barang ILIKE $2 OR b.nama_barang ILIKE $2)
        GROUP BY s.id_gudang, g.gudang, s.id_barang, b.nama_barang, sk.satuan_kecil
        HAVING (NOT $3 OR SUM(s.stok) > 0)
        ORDER BY s.id_gudang, s.id_barang
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&q.id_gudang)
    .bind(&search)
    .bind(only_avail)
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

async fn get_item_stock(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(id_barang): Path<String>,
) -> AppResult<Json<ItemStockDetail>> {
    let nama_barang: Option<String> =
        sqlx::query_scalar("SELECT nama_barang FROM barang WHERE id_barang = $1")
            .bind(&id_barang)
            .fetch_optional(&state.pool)
            .await?;

    let nama_barang = nama_barang
        .ok_or_else(|| AppError::NotFound(format!("Barang '{}' tidak ditemukan", id_barang)))?;

    let warehouses = sqlx::query_as::<_, WarehouseStockItem>(
        r#"
        SELECT s.id_gudang, g.gudang, COALESCE(SUM(s.stok), 0)::float8 AS qty
        FROM stok_barang s
        LEFT JOIN gudang g ON s.id_gudang = g.id_gudang
        WHERE s.id_barang = $1
        GROUP BY s.id_gudang, g.gudang
        HAVING SUM(s.stok) <> 0
        ORDER BY qty DESC, s.id_gudang
        "#,
    )
    .bind(&id_barang)
    .fetch_all(&state.pool)
    .await?;

    let total_qty = warehouses.iter().map(|w| w.qty).sum();

    Ok(Json(ItemStockDetail {
        id_barang,
        nama_barang,
        total_qty,
        warehouses,
    }))
}

async fn list_stock_card(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<StockCardMovement>>> {
    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM stok_barang s
        WHERE ($1::text IS NULL OR s.id_barang = $1)
          AND ($2::text IS NULL OR s.id_gudang = $2)
          AND ($3::date IS NULL OR s.tanggal >= $3)
          AND ($4::date IS NULL OR s.tanggal <= $4)
        "#,
    )
    .bind(&q.id_barang)
    .bind(&q.id_gudang)
    .bind(q.from)
    .bind(q.to)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, StockCardMovement>(
        r#"
        SELECT s.id_stok::float8 AS id_stok,
               s.tanggal,
               s.id_gudang,
               s.id_barang,
               s.reff,
               COALESCE(s.persediaan, 0)::float8 AS persediaan,
               COALESCE(s.stok, 0)::float8 AS stok,
               COALESCE(s.hpp, 0)::float8 AS hpp,
               s.batch
        FROM stok_barang s
        WHERE ($1::text IS NULL OR s.id_barang = $1)
          AND ($2::text IS NULL OR s.id_gudang = $2)
          AND ($3::date IS NULL OR s.tanggal >= $3)
          AND ($4::date IS NULL OR s.tanggal <= $4)
        ORDER BY s.tanggal DESC, s.id_stok DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(&q.id_barang)
    .bind(&q.id_gudang)
    .bind(q.from)
    .bind(q.to)
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

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/stock", get(list_stock))
        .route("/stock/{id_barang}", get(get_item_stock))
        .route("/stock-card", get(list_stock_card))
}
