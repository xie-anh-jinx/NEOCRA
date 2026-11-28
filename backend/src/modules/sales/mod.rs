use crate::{
    app::AppState,
    auth::AuthUser,
    events::DomainEvent,
    services::{
        audit::write_audit_log,
        notifications::{
            lookup_username_by_pegawai, mark_stage_action_taken, spawn_direct_notification,
            spawn_stage_notification, NotificationSpec,
        },
        numbering::{compute_line, compute_totals, next_so_number, LineCalc},
        outbox::emit_event,
    },
    utils::{f64_to_dec, AppError, AppResult, ListQuery, PaginatedResponse},
};
use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::NaiveDate;
use percent_encoding::{percent_decode_str, utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SalesOrderSummary {
    pub nomor: String,
    pub tanggal: Option<NaiveDate>,
    pub id_customer: Option<String>,
    pub customer: Option<String>,
    pub id_salesman: Option<String>,
    pub nama_salesman: Option<String>,
    pub id_gudang: Option<String>,
    pub gudang: Option<String>,
    pub referensi: Option<String>,
    pub deliverypoint: Option<String>,
    pub top: Option<i32>,
    pub is_ppn: Option<bool>,
    pub total: f64,
    pub total_discount: f64,
    pub dpp: f64,
    pub total_ppn: f64,
    pub grandtotal: f64,
    pub status: Option<String>,
    pub status_label: String,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SalesOrderLineDto {
    pub urut: i32,
    pub id_barang: Option<String>,
    pub nama_barang: Option<String>,
    pub id_gudang: Option<String>,
    pub qty: f64,
    pub harga: f64,
    pub diskonpersen: f64,
    pub diskonrp: f64,
    pub total: f64,
    pub diambil: f64,
    pub sisa: f64,
    pub delivery_date: Option<NaiveDate>,
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SalesOrderDetail {
    #[serde(flatten)]
    pub header: SalesOrderSummary,
    pub details: Vec<SalesOrderLineDto>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSoLineRequest {
    pub id_barang: String,
    pub qty: f64,
    pub harga: f64,
    pub diskonpersen: Option<f64>,
    pub remark: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSoRequest {
    pub tanggal: NaiveDate,
    pub id_customer: String,
    pub id_salesman: Option<String>,
    pub id_gudang: Option<String>,
    pub is_ppn: Option<bool>,
    pub top: Option<i32>,
    pub keterangan: Option<String>,
    pub referensi: Option<String>,
    pub deliverypoint: Option<String>,
    pub details: Vec<CreateSoLineRequest>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSoStatusRequest {
    pub status: String,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SalesInvoiceSummary {
    pub no_penjualan: String,
    pub tanggal: Option<NaiveDate>,
    pub id_customer: Option<String>,
    pub customer: Option<String>,
    pub no_do: Option<String>,
    pub faktur: Option<String>,
    pub total: f64,
    pub total_discount: f64,
    pub dpp: f64,
    pub total_ppn: f64,
    pub grandtotal: f64,
    pub total_bayar: f64,
    pub is_lunas: Option<String>,
    pub tgl_jatuh_tempo: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct SalesInvoiceLineDto {
    pub urut: i32,
    pub id_barang: Option<String>,
    pub nama_barang: Option<String>,
    pub id_gudang: Option<String>,
    pub qty: f64,
    pub harga: f64,
    pub diskonpersen: f64,
    pub diskonrp: f64,
    pub total: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SalesInvoiceDetail {
    #[serde(flatten)]
    pub header: SalesInvoiceSummary,
    pub details: Vec<SalesInvoiceLineDto>,
}

fn decode_key(raw: &str) -> String {
    percent_decode_str(raw).decode_utf8_lossy().into_owned()
}

async fn list_orders(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<SalesOrderSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM so a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        WHERE ($1::text IS NULL OR a.nomor ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1 OR COALESCE(a.referensi,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_customer = $4)
          AND ($5::text IS NULL OR a.status::text = $5)
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_customer)
    .bind(&q.status)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, SalesOrderSummary>(
        r#"
        SELECT a.nomor,
               a.tanggal,
               a.id_customer,
               c.customer,
               a.id_salesman,
               p.nama AS nama_salesman,
               a.id_gudang,
               g.gudang,
               a.referensi,
               a.deliverypoint,
               a.top,
               a.is_ppn,
               COALESCE(a.total, 0)::float8 AS total,
               COALESCE(a.total_discount, 0)::float8 AS total_discount,
               COALESCE(a.dpp, 0)::float8 AS dpp,
               COALESCE(a.total_ppn, 0)::float8 AS total_ppn,
               COALESCE(a.grandtotal, 0)::float8 AS grandtotal,
               a.status::text AS status,
               CASE a.status::text
                   WHEN 'D' THEN 'Draft'
                   WHEN 'S' THEN 'Submitted'
                   WHEN 'P' THEN 'Processed'
                   WHEN 'C' THEN 'Cancelled'
                   WHEN 'R' THEN 'Rejected'
                   ELSE COALESCE(a.status::text, 'Draft')
               END AS status_label
        FROM so a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        LEFT JOIN pegawai p ON a.id_salesman = p.id_pegawai
        LEFT JOIN gudang g ON a.id_gudang = g.id_gudang
        WHERE ($1::text IS NULL OR a.nomor ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1 OR COALESCE(a.referensi,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_customer = $4)
          AND ($5::text IS NULL OR a.status::text = $5)
        ORDER BY a.tanggal DESC NULLS LAST, a.nomor DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_customer)
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

async fn get_order(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(raw_nomor): Path<String>,
) -> AppResult<Json<SalesOrderDetail>> {
    let nomor = decode_key(&raw_nomor);

    let header = sqlx::query_as::<_, SalesOrderSummary>(
        r#"
        SELECT a.nomor,
               a.tanggal,
               a.id_customer,
               c.customer,
               a.id_salesman,
               p.nama AS nama_salesman,
               a.id_gudang,
               g.gudang,
               a.referensi,
               a.deliverypoint,
               a.top,
               a.is_ppn,
               COALESCE(a.total, 0)::float8 AS total,
               COALESCE(a.total_discount, 0)::float8 AS total_discount,
               COALESCE(a.dpp, 0)::float8 AS dpp,
               COALESCE(a.total_ppn, 0)::float8 AS total_ppn,
               COALESCE(a.grandtotal, 0)::float8 AS grandtotal,
               a.status::text AS status,
               CASE a.status::text
                   WHEN 'D' THEN 'Draft'
                   WHEN 'S' THEN 'Submitted'
                   WHEN 'P' THEN 'Processed'
                   WHEN 'C' THEN 'Cancelled'
                   WHEN 'R' THEN 'Rejected'
                   ELSE COALESCE(a.status::text, 'Draft')
               END AS status_label
        FROM so a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        LEFT JOIN pegawai p ON a.id_salesman = p.id_pegawai
        LEFT JOIN gudang g ON a.id_gudang = g.id_gudang
        WHERE a.nomor = $1
        "#,
    )
    .bind(&nomor)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Sales Order '{}' tidak ditemukan", nomor)))?;

    let details = sqlx::query_as::<_, SalesOrderLineDto>(
        r#"
        SELECT d.urut,
               d.id_barang,
               b.nama_barang,
               d.id_gudang,
               COALESCE(d.qty, 0)::float8 AS qty,
               COALESCE(d.harga, 0)::float8 AS harga,
               COALESCE(d.diskonpersen, 0)::float8 AS diskonpersen,
               COALESCE(d.diskonrp, 0)::float8 AS diskonrp,
               COALESCE(d.total, 0)::float8 AS total,
               COALESCE(d.diambil, 0)::float8 AS diambil,
               COALESCE(d.sisa, 0)::float8 AS sisa,
               d.delivery_date,
               d.remark
        FROM so_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.no_so = $1
        ORDER BY d.urut
        "#,
    )
    .bind(&nomor)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(SalesOrderDetail { header, details }))
}

async fn create_order(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateSoRequest>,
) -> AppResult<Json<SalesOrderDetail>> {
    auth.require_role("ROLE_SO")?;
    if req.details.is_empty() {
        return Err(AppError::Validation("Minimal 1 baris barang wajib diisi".into()));
    }

    let nomor = next_so_number(&state.pool, req.tanggal).await?;
    let is_ppn = req.is_ppn.unwrap_or(true);

    let line_calcs: Vec<LineCalc> = req
        .details
        .iter()
        .map(|l| compute_line(l.qty, l.harga, l.diskonpersen.unwrap_or(0.0), None))
        .collect();
    let totals = compute_totals(&line_calcs, is_ppn, false);

    let mut tx = state.pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO so (
            nomor, tanggal, id_customer, id_salesman, id_gudang,
            kode_mata_uang, is_ppn, top, keterangan, referensi, deliverypoint,
            total, total_discount, dpp, total_ppn, grandtotal,
            kode_user, status, jenis, create_date
        ) VALUES (
            $1, $2, $3, $4, $5,
            'IDR', $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, 'S', 'm', NOW()
        )
        "#,
    )
    .bind(&nomor)
    .bind(req.tanggal)
    .bind(&req.id_customer)
    .bind(req.id_salesman.as_deref().unwrap_or(&auth.id_pegawai))
    .bind(req.id_gudang.as_deref().unwrap_or("001"))
    .bind(is_ppn)
    .bind(req.top.unwrap_or(30))
    .bind(&req.keterangan)
    .bind(&req.referensi)
    .bind(&req.deliverypoint)
    .bind(f64_to_dec(totals.total))
    .bind(f64_to_dec(totals.total_discount))
    .bind(f64_to_dec(totals.dpp))
    .bind(f64_to_dec(totals.total_ppn))
    .bind(f64_to_dec(totals.grandtotal))
    .bind(&auth.id_pegawai)
    .execute(&mut *tx)
    .await?;

    for (idx, (line, calc)) in req.details.iter().zip(line_calcs.iter()).enumerate() {
        let urut = (idx + 1) as i32;
        sqlx::query(
            r#"
            INSERT INTO so_detail (
                no_so, urut, id_gudang, id_barang, qty, harga,
                diskonpersen, diskonrp, total, diambil, sisa, remark
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $5, $10)
            "#,
        )
        .bind(&nomor)
        .bind(urut)
        .bind(req.id_gudang.as_deref().unwrap_or("001"))
        .bind(&line.id_barang)
        .bind(f64_to_dec(line.qty))
        .bind(f64_to_dec(line.harga))
        .bind(f64_to_dec(line.diskonpersen.unwrap_or(0.0)))
        .bind(f64_to_dec(calc.diskon_rp))
        .bind(f64_to_dec(calc.net))
        .bind(&line.remark)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "sales.so.create",
        "so",
        Some(&nomor),
        serde_json::json!({ "grandtotal": totals.grandtotal }),
    )
    .await;

    let ev = DomainEvent::new(
        "sales.so.created",
        "so",
        &nomor,
        serde_json::json!({ "nomor": nomor, "grandtotal": totals.grandtotal }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    let action_url = format!(
        "/sales/orders/detail?id={}",
        utf8_percent_encode(&nomor, NON_ALPHANUMERIC)
    );
    spawn_stage_notification(
        state.pool.clone(),
        state.notif_tx.clone(),
        NotificationSpec {
            event_id: Some(ev_id),
            category: "action_needed".into(),
            module: "sales.so".into(),
            stage: Some("warehouse".into()),
            entity_type: "so".into(),
            entity_id: nomor.clone(),
            document_number: nomor.clone(),
            title: format!("Sales Order Baru: {}", nomor),
            message: format!(
                "SO dibuat oleh {} (Rp {:.0}). Siap ditinjau & diproses.",
                auth.username, totals.grandtotal
            ),
            action_url,
            actor_username: auth.username.clone(),
            actor_id_pegawai: Some(auth.id_pegawai.clone()),
            amount: totals.grandtotal,
            metadata: serde_json::json!({ "grandtotal": totals.grandtotal, "id_customer": req.id_customer }),
        },
        vec!["warehouse".into()],
    );

    get_order(State(state), auth, Path(nomor)).await
}

async fn update_order_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(raw_nomor): Path<String>,
    Json(req): Json<UpdateSoStatusRequest>,
) -> AppResult<Json<SalesOrderDetail>> {
    auth.require_role("ROLE_SO")?;
    let nomor = decode_key(&raw_nomor);

    let so_meta: Option<(Option<String>, Option<String>, f64)> = sqlx::query_as(
        "SELECT id_salesman, kode_user, COALESCE(grandtotal, 0)::float8 FROM so WHERE nomor = $1",
    )
    .bind(&nomor)
    .fetch_optional(&state.pool)
    .await?;

    sqlx::query("UPDATE so SET status = $2, modified_date = NOW() WHERE nomor = $1")
        .bind(&nomor)
        .bind(&req.status)
        .execute(&state.pool)
        .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "sales.so.status",
        "so",
        Some(&nomor),
        serde_json::json!({ "status": req.status }),
    )
    .await;

    let ev = DomainEvent::new(
        "sales.so.status_changed",
        "so",
        &nomor,
        serde_json::json!({ "nomor": nomor, "status": req.status }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    mark_stage_action_taken(&state.pool, "so", &nomor, &[]).await;

    if let Some((salesman_id, creator_id, grandtotal)) = so_meta {
        let target_pegawai = creator_id.or(salesman_id);
        if let Some(pid) = target_pegawai.as_deref() {
            if let Some(target_uname) = lookup_username_by_pegawai(&state.pool, pid).await {
                let status_text = match req.status.as_str() {
                    "P" => "Diproses (Processed)",
                    "C" => "Dibatalkan (Cancelled)",
                    "R" => "Ditolak (Rejected)",
                    "S" => "Submitted",
                    _ => req.status.as_str(),
                };
                let action_url = format!(
                    "/sales/orders/detail?id={}",
                    utf8_percent_encode(&nomor, NON_ALPHANUMERIC)
                );
                spawn_direct_notification(
                    state.pool.clone(),
                    state.notif_tx.clone(),
                    NotificationSpec {
                        event_id: Some(ev_id),
                        category: "status_update".into(),
                        module: "sales.so".into(),
                        stage: None,
                        entity_type: "so".into(),
                        entity_id: nomor.clone(),
                        document_number: nomor.clone(),
                        title: format!("SO {}: {}", status_text, nomor),
                        message: format!(
                            "Status Sales Order diubah menjadi {} oleh {}.",
                            status_text, auth.username
                        ),
                        action_url,
                        actor_username: auth.username.clone(),
                        actor_id_pegawai: Some(auth.id_pegawai.clone()),
                        amount: grandtotal,
                        metadata: serde_json::json!({ "status": req.status, "grandtotal": grandtotal }),
                    },
                    vec![target_uname],
                );
            }
        }
    }

    get_order(State(state), auth, Path(nomor)).await
}

async fn list_invoices(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<SalesInvoiceSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM penjualan a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        WHERE ($1::text IS NULL OR a.no_penjualan ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1 OR COALESCE(a.no_do,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_customer = $4)
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_customer)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, SalesInvoiceSummary>(
        r#"
        SELECT a.no_penjualan,
               a.tanggal,
               a.id_customer,
               c.customer,
               a.no_do,
               a.faktur,
               COALESCE(a.total, 0)::float8 AS total,
               COALESCE(a.total_discount, 0)::float8 AS total_discount,
               COALESCE(a.dpp, 0)::float8 AS dpp,
               COALESCE(a.total_ppn, 0)::float8 AS total_ppn,
               COALESCE(a.grandtotal, 0)::float8 AS grandtotal,
               COALESCE(a.total_bayar, 0)::float8 AS total_bayar,
               a.is_lunas,
               a.tgl_jatuh_tempo,
               a.status::text AS status
        FROM penjualan a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        WHERE ($1::text IS NULL OR a.no_penjualan ILIKE $1 OR COALESCE(c.customer,'') ILIKE $1 OR COALESCE(a.no_do,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_customer = $4)
        ORDER BY a.tanggal DESC NULLS LAST, a.no_penjualan DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_customer)
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

async fn get_invoice(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(raw_no): Path<String>,
) -> AppResult<Json<SalesInvoiceDetail>> {
    let no_penjualan = decode_key(&raw_no);

    let header = sqlx::query_as::<_, SalesInvoiceSummary>(
        r#"
        SELECT a.no_penjualan,
               a.tanggal,
               a.id_customer,
               c.customer,
               a.no_do,
               a.faktur,
               COALESCE(a.total, 0)::float8 AS total,
               COALESCE(a.total_discount, 0)::float8 AS total_discount,
               COALESCE(a.dpp, 0)::float8 AS dpp,
               COALESCE(a.total_ppn, 0)::float8 AS total_ppn,
               COALESCE(a.grandtotal, 0)::float8 AS grandtotal,
               COALESCE(a.total_bayar, 0)::float8 AS total_bayar,
               a.is_lunas,
               a.tgl_jatuh_tempo,
               a.status::text AS status
        FROM penjualan a
        LEFT JOIN customer c ON a.id_customer = c.id_kontak
        WHERE a.no_penjualan = $1
        "#,
    )
    .bind(&no_penjualan)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Invoice '{}' tidak ditemukan", no_penjualan)))?;

    let details = sqlx::query_as::<_, SalesInvoiceLineDto>(
        r#"
        SELECT d.urut,
               d.id_barang,
               b.nama_barang,
               d.id_gudang,
               COALESCE(d.qty, 0)::float8 AS qty,
               COALESCE(d.harga, 0)::float8 AS harga,
               COALESCE(d.diskonpersen, 0)::float8 AS diskonpersen,
               COALESCE(d.diskonrp, 0)::float8 AS diskonrp,
               COALESCE(d.total, 0)::float8 AS total
        FROM penjualan_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.no_penjualan = $1
        ORDER BY d.urut
        "#,
    )
    .bind(&no_penjualan)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(SalesInvoiceDetail { header, details }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/orders", get(list_orders).post(create_order))
        .route("/orders/{nomor}", get(get_order))
        .route("/orders/{nomor}/status", post(update_order_status))
        .route("/invoices", get(list_invoices))
        .route("/invoices/{no_penjualan}", get(get_invoice))
}
