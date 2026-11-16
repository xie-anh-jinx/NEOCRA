use crate::{
    app::AppState,
    auth::AuthUser,
    utils::AppResult,
};
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct PendingCounts {
    pub purchase_requests: i64,
    pub purchase_orders: i64,
    pub sales_orders: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ThisMonthKpi {
    pub sales_orders_count: i64,
    pub sales_orders_value: f64,
    pub invoices_value: f64,
    pub purchase_orders_value: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OutstandingSummary {
    pub ar: f64,
    pub ap: f64,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct MonthlyTrendPoint {
    pub month: String,
    pub total: f64,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct TopCustomerItem {
    pub id_customer: String,
    pub customer: String,
    pub total: f64,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct TopItemRow {
    pub id_barang: String,
    pub nama_barang: String,
    pub qty: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DashboardResponse {
    pub pending: PendingCounts,
    pub this_month: ThisMonthKpi,
    pub outstanding: OutstandingSummary,
    pub sales_trend: Vec<MonthlyTrendPoint>,
    pub purchase_trend: Vec<MonthlyTrendPoint>,
    pub top_customers: Vec<TopCustomerItem>,
    pub top_items: Vec<TopItemRow>,
}

async fn dashboard_handler(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<DashboardResponse>> {
    let pending_pp: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM permintaan_pembelian WHERE status_approved IS NULL AND gm_status IS NULL",
    )
    .fetch_one(&state.pool)
    .await?;

    let pending_po: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM po WHERE is_approve IS NULL",
    )
    .fetch_one(&state.pool)
    .await?;

    let pending_so: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM so WHERE status::text IN ('D', 'S')",
    )
    .fetch_one(&state.pool)
    .await?;

    // Determine latest transaction month in DB (data ends around 2026-06)
    let latest_ym: (i32, i32) = sqlx::query_as(
        r#"
        SELECT COALESCE(EXTRACT(YEAR FROM MAX(tanggal))::int, 2026),
               COALESCE(EXTRACT(MONTH FROM MAX(tanggal))::int, 6)
        FROM so
        "#,
    )
    .fetch_one(&state.pool)
    .await?;

    let (yr, mo) = latest_ym;

    let (so_count, so_val): (i64, f64) = sqlx::query_as(
        r#"
        SELECT COUNT(*), COALESCE(SUM(grandtotal), 0)::float8
        FROM so
        WHERE EXTRACT(YEAR FROM tanggal) = $1 AND EXTRACT(MONTH FROM tanggal) = $2
        "#,
    )
    .bind(yr)
    .bind(mo)
    .fetch_one(&state.pool)
    .await?;

    let inv_val: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(grandtotal), 0)::float8
        FROM penjualan
        WHERE EXTRACT(YEAR FROM tanggal) = $1 AND EXTRACT(MONTH FROM tanggal) = $2
        "#,
    )
    .bind(yr)
    .bind(mo)
    .fetch_one(&state.pool)
    .await?;

    let po_val: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(COALESCE(total,0) - COALESCE(total_discount,0) + COALESCE(total_ppn,0) + COALESCE(total_pph,0)), 0)::float8
        FROM po
        WHERE EXTRACT(YEAR FROM tanggal) = $1 AND EXTRACT(MONTH FROM tanggal) = $2
        "#,
    )
    .bind(yr)
    .bind(mo)
    .fetch_one(&state.pool)
    .await?;

    let ar_out: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(GREATEST(COALESCE(total, amount, 0) - COALESCE(bayar, 0), 0)), 0)::float8 FROM acc_ar_faktur",
    )
    .fetch_one(&state.pool)
    .await?;

    let ap_out: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(GREATEST(COALESCE(total, amount, 0) - COALESCE(bayar, 0), 0)), 0)::float8 FROM acc_ap_faktur",
    )
    .fetch_one(&state.pool)
    .await?;

    let sales_trend = sqlx::query_as::<_, MonthlyTrendPoint>(
        r#"
        SELECT to_char(tanggal, 'YYYY-MM') AS month,
               COALESCE(SUM(grandtotal), 0)::float8 AS total
        FROM penjualan
        WHERE tanggal IS NOT NULL
        GROUP BY to_char(tanggal, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map(|mut v| {
        v.reverse();
        v
    })?;

    let purchase_trend = sqlx::query_as::<_, MonthlyTrendPoint>(
        r#"
        SELECT to_char(tanggal, 'YYYY-MM') AS month,
               COALESCE(SUM(COALESCE(total,0) - COALESCE(total_discount,0) + COALESCE(total_ppn,0) + COALESCE(total_pph,0)), 0)::float8 AS total
        FROM po
        WHERE tanggal IS NOT NULL
        GROUP BY to_char(tanggal, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map(|mut v| {
        v.reverse();
        v
    })?;

    let top_customers = sqlx::query_as::<_, TopCustomerItem>(
        r#"
        SELECT a.id_customer,
               COALESCE(c.customer, a.id_customer) AS customer,
               COALESCE(SUM(a.grandtotal), 0)::float8 AS total
        FROM penjualan a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        WHERE a.id_customer IS NOT NULL
        GROUP BY a.id_customer, c.customer
        ORDER BY total DESC
        LIMIT 8
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    let top_items = sqlx::query_as::<_, TopItemRow>(
        r#"
        SELECT d.id_barang,
               COALESCE(b.nama_barang, d.id_barang) AS nama_barang,
               COALESCE(SUM(d.qty), 0)::float8 AS qty
        FROM penjualan_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.id_barang IS NOT NULL
        GROUP BY d.id_barang, b.nama_barang
        ORDER BY qty DESC
        LIMIT 8
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(DashboardResponse {
        pending: PendingCounts {
            purchase_requests: pending_pp,
            purchase_orders: pending_po,
            sales_orders: pending_so,
        },
        this_month: ThisMonthKpi {
            sales_orders_count: so_count,
            sales_orders_value: so_val,
            invoices_value: inv_val,
            purchase_orders_value: po_val,
        },
        outstanding: OutstandingSummary {
            ar: ar_out,
            ap: ap_out,
        },
        sales_trend,
        purchase_trend,
        top_customers,
        top_items,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/dashboard", get(dashboard_handler))
}
