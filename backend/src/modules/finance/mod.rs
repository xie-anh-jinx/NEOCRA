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
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Clone, FromRow)]
struct AccountRow {
    id_account: i32,
    account: String,
    parent: Option<i32>,
    level: Option<i32>,
    aktif: Option<bool>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AccountNode {
    pub id_account: i32,
    pub account: String,
    pub parent: Option<i32>,
    pub level: Option<i32>,
    pub aktif: Option<bool>,
    #[schema(no_recursion)]
    pub children: Vec<AccountNode>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct ArInvoiceRow {
    pub ar_number: String,
    pub ar_date: Option<NaiveDate>,
    pub customer_code: Option<String>,
    pub customer: Option<String>,
    pub no_invoice: Option<String>,
    pub total: f64,
    pub bayar: f64,
    pub outstanding: f64,
    pub due_date: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct ApInvoiceRow {
    pub ap_number: String,
    pub ap_date: Option<NaiveDate>,
    pub vendor_code: Option<String>,
    pub supplier: Option<String>,
    pub po_number: Option<String>,
    pub reff: Option<String>,
    pub total: f64,
    pub bayar: f64,
    pub outstanding: f64,
    pub due_date: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct JournalSummary {
    pub gl_number: String,
    pub gl_date: NaiveDate,
    pub journal_code: Option<String>,
    pub note: Option<String>,
    pub reference: Option<String>,
    pub jumlah: f64,
    pub posting: Option<bool>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct JournalLineDto {
    pub line: i32,
    pub id_account: Option<i32>,
    pub account: Option<String>,
    pub is_debit: Option<bool>,
    pub value: f64,
    pub keterangan: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct JournalDetail {
    #[serde(flatten)]
    pub header: JournalSummary,
    pub lines: Vec<JournalLineDto>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct CashTransactionRow {
    pub nomor: String,
    pub tanggal: NaiveDate,
    pub id_jenis_transaksi: Option<String>,
    pub id_kantor: String,
    pub uraian: Option<String>,
    pub total: f64,
    pub kepada: Option<String>,
    pub status: String,
}

fn decode_key(raw: &str) -> String {
    percent_decode_str(raw).decode_utf8_lossy().into_owned()
}

async fn list_accounts(
    State(state): State<AppState>,
    _auth: AuthUser,
) -> AppResult<Json<Vec<AccountNode>>> {
    let rows = sqlx::query_as::<_, AccountRow>(
        "SELECT id_account, account, parent, level, aktif FROM account ORDER BY id_account",
    )
    .fetch_all(&state.pool)
    .await?;

    let mut children_map: HashMap<i32, Vec<AccountRow>> = HashMap::new();
    let mut roots: Vec<AccountRow> = Vec::new();
    let all_ids: std::collections::HashSet<i32> = rows.iter().map(|r| r.id_account).collect();

    for r in rows {
        match r.parent {
            Some(p) if p != 0 && p != r.id_account && all_ids.contains(&p) => {
                children_map.entry(p).or_default().push(r);
            }
            _ => roots.push(r),
        }
    }

    fn build_node(row: AccountRow, map: &HashMap<i32, Vec<AccountRow>>) -> AccountNode {
        let children = map
            .get(&row.id_account)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|c| build_node(c, map))
            .collect();
        AccountNode {
            id_account: row.id_account,
            account: row.account,
            parent: row.parent,
            level: row.level,
            aktif: row.aktif,
            children,
        }
    }

    let tree = roots
        .into_iter()
        .map(|r| build_node(r, &children_map))
        .collect();
    Ok(Json(tree))
}

async fn list_ar(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<ArInvoiceRow>>> {
    let search = q.search_pattern();
    let cust = q.customer_code.as_ref().or(q.id_customer.as_ref());

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM acc_ar_faktur a
        LEFT JOIN customer c ON a.customer_code = c.id_kontak
        WHERE ($1::text IS NULL OR a.ar_number ILIKE $1 OR COALESCE(a.no_invoice,'') ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1)
          AND ($2::date IS NULL OR a.ar_date >= $2)
          AND ($3::date IS NULL OR a.ar_date <= $3)
          AND ($4::text IS NULL OR a.customer_code = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'open' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) > 0)
              OR ($5 = 'paid' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) <= 0)
          )
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(cust)
    .bind(&q.status)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, ArInvoiceRow>(
        r#"
        SELECT a.ar_number,
               a.ar_date,
               a.customer_code,
               c.customer,
               a.no_invoice,
               COALESCE(a.total, a.amount, 0)::float8 AS total,
               COALESCE(a.bayar, 0)::float8 AS bayar,
               (COALESCE(a.total, a.amount, 0) - COALESCE(a.bayar, 0))::float8 AS outstanding,
               a.due_date,
               a.status
        FROM acc_ar_faktur a
        LEFT JOIN customer c ON a.customer_code = c.id_kontak
        WHERE ($1::text IS NULL OR a.ar_number ILIKE $1 OR COALESCE(a.no_invoice,'') ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1)
          AND ($2::date IS NULL OR a.ar_date >= $2)
          AND ($3::date IS NULL OR a.ar_date <= $3)
          AND ($4::text IS NULL OR a.customer_code = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'open' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) > 0)
              OR ($5 = 'paid' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) <= 0)
          )
        ORDER BY a.ar_date DESC NULLS LAST, a.ar_number DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(cust)
    .bind(&q.status)
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

async fn list_ap(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<ApInvoiceRow>>> {
    let search = q.search_pattern();
    let vendor = q.vendor_code.as_ref().or(q.id_supplier.as_ref());

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM acc_ap_faktur a
        LEFT JOIN supplier s ON a.vendor_code = s.id
        WHERE ($1::text IS NULL OR a.ap_number ILIKE $1 OR COALESCE(a.po_number,'') ILIKE $1 OR COALESCE(s.supplier,'') ILIKE $1)
          AND ($2::date IS NULL OR a.ap_date >= $2)
          AND ($3::date IS NULL OR a.ap_date <= $3)
          AND ($4::text IS NULL OR a.vendor_code = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'open' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) > 0)
              OR ($5 = 'paid' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) <= 0)
          )
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(vendor)
    .bind(&q.status)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, ApInvoiceRow>(
        r#"
        SELECT a.ap_number,
               a.ap_date,
               a.vendor_code,
               s.supplier,
               a.po_number,
               a.reff,
               COALESCE(a.total, a.amount, 0)::float8 AS total,
               COALESCE(a.bayar, 0)::float8 AS bayar,
               (COALESCE(a.total, a.amount, 0) - COALESCE(a.bayar, 0))::float8 AS outstanding,
               a.due_date,
               a.status
        FROM acc_ap_faktur a
        LEFT JOIN supplier s ON a.vendor_code = s.id
        WHERE ($1::text IS NULL OR a.ap_number ILIKE $1 OR COALESCE(a.po_number,'') ILIKE $1 OR COALESCE(s.supplier,'') ILIKE $1)
          AND ($2::date IS NULL OR a.ap_date >= $2)
          AND ($3::date IS NULL OR a.ap_date <= $3)
          AND ($4::text IS NULL OR a.vendor_code = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'open' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) > 0)
              OR ($5 = 'paid' AND COALESCE(a.total, 0) - COALESCE(a.bayar, 0) <= 0)
          )
        ORDER BY a.ap_date DESC NULLS LAST, a.ap_number DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(vendor)
    .bind(&q.status)
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

async fn list_journals(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<JournalSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM acc_gl_trans a
        WHERE ($1::text IS NULL OR a.gl_number ILIKE $1 OR COALESCE(a.reference,'') ILIKE $1 OR COALESCE(a.note,'') ILIKE $1)
          AND ($2::date IS NULL OR a.gl_date >= $2)
          AND ($3::date IS NULL OR a.gl_date <= $3)
          AND ($4::text IS NULL OR a.journal_code = $4)
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.journal_code)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, JournalSummary>(
        r#"
        SELECT a.gl_number,
               a.gl_date,
               a.journal_code,
               a.note,
               a.reference,
               COALESCE(a.jumlah, 0)::float8 AS jumlah,
               a.posting
        FROM acc_gl_trans a
        WHERE ($1::text IS NULL OR a.gl_number ILIKE $1 OR COALESCE(a.reference,'') ILIKE $1 OR COALESCE(a.note,'') ILIKE $1)
          AND ($2::date IS NULL OR a.gl_date >= $2)
          AND ($3::date IS NULL OR a.gl_date <= $3)
          AND ($4::text IS NULL OR a.journal_code = $4)
        ORDER BY a.gl_date DESC, a.gl_number DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.journal_code)
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

async fn get_journal(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(raw_gl): Path<String>,
) -> AppResult<Json<JournalDetail>> {
    let gl_number = decode_key(&raw_gl);

    let header = sqlx::query_as::<_, JournalSummary>(
        r#"
        SELECT a.gl_number,
               a.gl_date,
               a.journal_code,
               a.note,
               a.reference,
               COALESCE(a.jumlah, 0)::float8 AS jumlah,
               a.posting
        FROM acc_gl_trans a
        WHERE a.gl_number = $1
        "#,
    )
    .bind(&gl_number)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Jurnal '{}' tidak ditemukan", gl_number)))?;

    let lines = sqlx::query_as::<_, JournalLineDto>(
        r#"
        SELECT d.line,
               d.id_account,
               ac.account,
               d.is_debit,
               COALESCE(d.value, 0)::float8 AS value,
               d.keterangan
        FROM acc_gl_detail d
        LEFT JOIN account ac ON d.id_account = ac.id_account
        WHERE d.gl_number = $1
        ORDER BY d.line
        "#,
    )
    .bind(&gl_number)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(JournalDetail { header, lines }))
}

async fn list_cash(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<CashTransactionRow>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM acc_kas a
        WHERE ($1::text IS NULL OR a.nomor ILIKE $1 OR COALESCE(a.uraian,'') ILIKE $1 OR COALESCE(a.kepada,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, CashTransactionRow>(
        r#"
        SELECT a.nomor,
               a.tanggal,
               a.id_jenis_transaksi::text AS id_jenis_transaksi,
               a.id_kantor,
               a.uraian,
               COALESCE(a.total, 0)::float8 AS total,
               a.kepada,
               a.status::text AS status
        FROM acc_kas a
        WHERE ($1::text IS NULL OR a.nomor ILIKE $1 OR COALESCE(a.uraian,'') ILIKE $1 OR COALESCE(a.kepada,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
        ORDER BY a.tanggal DESC, a.id DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&search)
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
        .route("/accounts", get(list_accounts))
        .route("/ar", get(list_ar))
        .route("/ap", get(list_ap))
        .route("/journals", get(list_journals))
        .route("/journals/{gl_number}", get(get_journal))
        .route("/cash", get(list_cash))
}
