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
        numbering::{
            compute_line, compute_totals, next_po_number, next_pp_number, LineCalc,
        },
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
pub struct PurchaseRequestSummary {
    pub no_pp: String,
    pub tanggal: NaiveDate,
    pub dibuat: Option<String>,
    pub nama_pembuat: Option<String>,
    pub keterangan: Option<String>,
    pub jenis: Option<String>,
    pub total: f64,
    pub spv_status: Option<bool>,
    pub gm_status: Option<bool>,
    pub whm_status: Option<bool>,
    pub status_approved: Option<bool>,
    pub status_label: String,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct PurchaseRequestDetailLine {
    pub urut: i32,
    pub id_barang: String,
    pub nama_barang: Option<String>,
    pub keperluan: Option<String>,
    pub spesifikasi: Option<String>,
    pub jumlah_order: f64,
    pub jumlah_stok: Option<f64>,
    pub satuan: Option<String>,
    pub harga: f64,
    pub amount: f64,
    pub tanggal_dibutuhkan: Option<String>,
    pub keterangan: Option<String>,
    pub id_departemen: Option<i32>,
    pub id_kantor: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PurchaseRequestDetail {
    #[serde(flatten)]
    pub header: PurchaseRequestSummary,
    pub details: Vec<PurchaseRequestDetailLine>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePurchaseRequestLine {
    pub id_barang: String,
    pub keperluan: Option<String>,
    pub spesifikasi: Option<String>,
    pub jumlah_order: f64,
    pub jumlah_stok: Option<f64>,
    pub satuan: Option<String>,
    pub harga: Option<f64>,
    pub tanggal_dibutuhkan: Option<String>,
    pub keterangan: Option<String>,
    pub id_departemen: Option<i32>,
    pub id_kantor: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePurchaseRequestPayload {
    pub tanggal: NaiveDate,
    pub jenis: Option<String>,
    pub keterangan: Option<String>,
    pub details: Vec<CreatePurchaseRequestLine>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ApprovePpRequest {
    pub level: String,
    pub approve: bool,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct PurchaseOrderSummary {
    pub id: i32,
    pub nomor_po: String,
    pub tanggal: NaiveDate,
    pub id_supplier: String,
    pub nama_supplier: Option<String>,
    pub id_gudang: Option<String>,
    pub gudang: Option<String>,
    pub jenis_po: Option<String>,
    pub kode_mata_uang: Option<String>,
    pub is_ppn: Option<bool>,
    pub is_pph: Option<bool>,
    pub top: Option<i32>,
    pub keterangan: Option<String>,
    pub shipto: Option<String>,
    pub referensi: Option<String>,
    pub total: f64,
    pub total_discount: f64,
    pub total_ppn: f64,
    pub total_pph: f64,
    pub grandtotal: f64,
    pub is_checked1: Option<bool>,
    pub is_approve: Option<bool>,
    pub status_label: String,
    pub no_intruksi_po: Option<String>,
}

#[derive(Debug, Serialize, FromRow, ToSchema)]
pub struct PurchaseOrderLineDto {
    pub urut: i32,
    pub id_barang: String,
    pub nama_barang: Option<String>,
    pub qty: f64,
    pub harga: f64,
    pub diskonpersen: f64,
    pub diskonrp: f64,
    pub total: f64,
    pub diambil: f64,
    pub sisa: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PurchaseOrderDetail {
    #[serde(flatten)]
    pub header: PurchaseOrderSummary,
    pub details: Vec<PurchaseOrderLineDto>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePoLineRequest {
    pub id_barang: String,
    pub qty: f64,
    pub harga: f64,
    pub diskonpersen: Option<f64>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePoRequest {
    pub tanggal: NaiveDate,
    pub id_supplier: String,
    pub id_gudang: Option<String>,
    pub jenis_po: Option<String>,
    pub kode_mata_uang: Option<String>,
    pub is_ppn: Option<bool>,
    pub is_pph: Option<bool>,
    pub top: Option<i32>,
    pub keterangan: Option<String>,
    pub shipto: Option<String>,
    pub referensi: Option<String>,
    pub details: Vec<CreatePoLineRequest>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PoDecisionRequest {
    pub approve: bool,
    pub note: Option<String>,
}

fn decode_path_key(raw: &str) -> String {
    percent_decode_str(raw).decode_utf8_lossy().into_owned()
}

async fn list_requests(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<PurchaseRequestSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM permintaan_pembelian a
        LEFT JOIN pegawai p ON a.dibuat = p.id_pegawai
        WHERE ($1::text IS NULL OR a.no_pp ILIKE $1 OR COALESCE(a.keterangan,'') ILIKE $1 OR COALESCE(p.nama,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.jenis::text = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'approved' AND (a.status_approved = true OR a.gm_status = true))
              OR ($5 = 'rejected' AND (a.status_approved = false OR a.spv_status = false OR a.gm_status = false))
              OR ($5 = 'pending' AND a.status_approved IS NULL AND a.gm_status IS NULL)
          )
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.jenis)
    .bind(&q.status)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, PurchaseRequestSummary>(
        r#"
        SELECT a.no_pp,
               a.tanggal,
               a.dibuat,
               p.nama AS nama_pembuat,
               a.keterangan,
               a.jenis::text AS jenis,
               COALESCE(a.total, 0)::float8 AS total,
               a.spv_status,
               a.gm_status,
               a.whm_status,
               a.status_approved,
               CASE
                   WHEN a.status_approved = true OR a.gm_status = true THEN 'Approved'
                   WHEN a.status_approved = false OR a.spv_status = false OR a.gm_status = false THEN 'Rejected'
                   WHEN a.whm_status = true OR a.spv_status = true THEN 'Checked'
                   ELSE 'Pending'
               END AS status_label
        FROM permintaan_pembelian a
        LEFT JOIN pegawai p ON a.dibuat = p.id_pegawai
        WHERE ($1::text IS NULL OR a.no_pp ILIKE $1 OR COALESCE(a.keterangan,'') ILIKE $1 OR COALESCE(p.nama,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.jenis::text = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'approved' AND (a.status_approved = true OR a.gm_status = true))
              OR ($5 = 'rejected' AND (a.status_approved = false OR a.spv_status = false OR a.gm_status = false))
              OR ($5 = 'pending' AND a.status_approved IS NULL AND a.gm_status IS NULL)
          )
        ORDER BY a.tanggal DESC, a.no_pp DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.jenis)
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

async fn get_request(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(raw_no_pp): Path<String>,
) -> AppResult<Json<PurchaseRequestDetail>> {
    let no_pp = decode_path_key(&raw_no_pp);

    let header = sqlx::query_as::<_, PurchaseRequestSummary>(
        r#"
        SELECT a.no_pp,
               a.tanggal,
               a.dibuat,
               p.nama AS nama_pembuat,
               a.keterangan,
               a.jenis::text AS jenis,
               COALESCE(a.total, 0)::float8 AS total,
               a.spv_status,
               a.gm_status,
               a.whm_status,
               a.status_approved,
               CASE
                   WHEN a.status_approved = true OR a.gm_status = true THEN 'Approved'
                   WHEN a.status_approved = false OR a.spv_status = false OR a.gm_status = false THEN 'Rejected'
                   WHEN a.whm_status = true OR a.spv_status = true THEN 'Checked'
                   ELSE 'Pending'
               END AS status_label
        FROM permintaan_pembelian a
        LEFT JOIN pegawai p ON a.dibuat = p.id_pegawai
        WHERE a.no_pp = $1
        "#,
    )
    .bind(&no_pp)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Permintaan Pembelian '{}' tidak ditemukan", no_pp)))?;

    let details = sqlx::query_as::<_, PurchaseRequestDetailLine>(
        r#"
        SELECT d.urut,
               d.id_barang,
               b.nama_barang,
               d.keperluan,
               d.spesifikasi,
               COALESCE(d.jumlah_order, 0)::float8 AS jumlah_order,
               d.jumlah_stok::float8 AS jumlah_stok,
               d.satuan,
               COALESCE(d.harga, 0)::float8 AS harga,
               COALESCE(d.amount, COALESCE(d.jumlah_order, 0) * COALESCE(d.harga, 0))::float8 AS amount,
               d.tanggal_dibutuhkan,
               d.keterangan,
               d.id_departemen,
               d.id_kantor
        FROM permintaan_pembeliaan_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.no_pp = $1
        ORDER BY d.urut
        "#,
    )
    .bind(&no_pp)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PurchaseRequestDetail { header, details }))
}

async fn create_request(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreatePurchaseRequestPayload>,
) -> AppResult<Json<PurchaseRequestDetail>> {
    auth.require_role("ROLE_PERMINTAAN")?;
    if req.details.is_empty() {
        return Err(AppError::Validation(
            "Minimal 1 item detail wajib diisi".into(),
        ));
    }

    let no_pp = next_pp_number(&state.pool, req.tanggal).await?;
    let jenis = req
        .jenis
        .as_deref()
        .and_then(|s| s.chars().next())
        .unwrap_or('D')
        .to_string();

    let mut total = 0.0_f64;
    for l in &req.details {
        total += l.jumlah_order * l.harga.unwrap_or(0.0);
    }

    let mut tx = state.pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO permintaan_pembelian (
            no_pp, tanggal, dibuat, keterangan, id_perusahaan,
            status_dibuat, jenis, total, create_date, is_new
        ) VALUES ($1, $2, $3, $4, '01', true, $5, $6, NOW(), true)
        "#,
    )
    .bind(&no_pp)
    .bind(req.tanggal)
    .bind(&auth.id_pegawai)
    .bind(&req.keterangan)
    .bind(&jenis)
    .bind(f64_to_dec(total))
    .execute(&mut *tx)
    .await?;

    for (idx, line) in req.details.iter().enumerate() {
        let urut = (idx + 1) as i32;
        let harga = line.harga.unwrap_or(0.0);
        let amount = line.jumlah_order * harga;

        sqlx::query(
            r#"
            INSERT INTO permintaan_pembeliaan_detail (
                no_pp, urut, id_barang, keperluan, spesifikasi,
                jumlah_order, jumlah_stok, tanggal_dibutuhkan, keterangan,
                satuan, harga, amount, id_departemen, id_pg, id_kantor
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            "#,
        )
        .bind(&no_pp)
        .bind(urut)
        .bind(&line.id_barang)
        .bind(&line.keperluan)
        .bind(&line.spesifikasi)
        .bind(f64_to_dec(line.jumlah_order))
        .bind(line.jumlah_stok.map(f64_to_dec))
        .bind(&line.tanggal_dibutuhkan)
        .bind(&line.keterangan)
        .bind(&line.satuan)
        .bind(f64_to_dec(harga))
        .bind(f64_to_dec(amount))
        .bind(line.id_departemen)
        .bind(&auth.id_pegawai)
        .bind(&line.id_kantor)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "purchasing.pp.create",
        "permintaan_pembelian",
        Some(&no_pp),
        serde_json::json!({ "total": total }),
    )
    .await;

    let ev = DomainEvent::new(
        "purchasing.pp.created",
        "permintaan_pembelian",
        &no_pp,
        serde_json::json!({ "no_pp": no_pp, "total": total, "created_by": auth.username }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    let action_url = format!(
        "/purchasing/requests/detail?id={}",
        utf8_percent_encode(&no_pp, NON_ALPHANUMERIC)
    );
    spawn_stage_notification(
        state.pool.clone(),
        state.notif_tx.clone(),
        NotificationSpec {
            event_id: Some(ev_id),
            category: "approval_needed".into(),
            module: "purchasing.pp".into(),
            stage: Some("whm".into()),
            entity_type: "permintaan_pembelian".into(),
            entity_id: no_pp.clone(),
            document_number: no_pp.clone(),
            title: format!("PP Baru Menunggu Verifikasi: {}", no_pp),
            message: format!(
                "Permintaan Pembelian dibuat oleh {} (Est. Rp {:.0}). Mohon verifikasi SPV / WHM.",
                auth.username, total
            ),
            action_url,
            actor_username: auth.username.clone(),
            actor_id_pegawai: Some(auth.id_pegawai.clone()),
            amount: total,
            metadata: serde_json::json!({ "total": total, "jenis": jenis }),
        },
        vec!["spv".into(), "whm".into()],
    );

    get_request(State(state), auth, Path(no_pp)).await
}

async fn approve_request(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(raw_no_pp): Path<String>,
    Json(req): Json<ApprovePpRequest>,
) -> AppResult<Json<PurchaseRequestDetail>> {
    auth.require_role("ROLE_PERMINTAAN")?;
    let no_pp = decode_path_key(&raw_no_pp);

    let pp_meta: Option<(Option<String>, f64)> = sqlx::query_as(
        "SELECT dibuat, COALESCE(total, 0)::float8 FROM permintaan_pembelian WHERE no_pp = $1",
    )
    .bind(&no_pp)
    .fetch_optional(&state.pool)
    .await?;
    let (creator_pegawai, total) = pp_meta
        .ok_or_else(|| AppError::NotFound(format!("Permintaan Pembelian '{}' tidak ditemukan", no_pp)))?;

    match req.level.as_str() {
        "spv" => {
            sqlx::query(
                "UPDATE permintaan_pembelian SET spv = $2, spv_date = NOW(), spv_status = $3 WHERE no_pp = $1",
            )
            .bind(&no_pp)
            .bind(&auth.id_pegawai)
            .bind(req.approve)
            .execute(&state.pool)
            .await?;
        }
        "whm" => {
            sqlx::query(
                "UPDATE permintaan_pembelian SET whm = $2, whm_date = NOW(), whm_status = $3 WHERE no_pp = $1",
            )
            .bind(&no_pp)
            .bind(&auth.id_pegawai)
            .bind(req.approve)
            .execute(&state.pool)
            .await?;
        }
        "gm" => {
            sqlx::query(
                "UPDATE permintaan_pembelian SET gm = $2, gm_date = NOW(), gm_status = $3, status_approved = $3, approved = $3 WHERE no_pp = $1",
            )
            .bind(&no_pp)
            .bind(&auth.id_pegawai)
            .bind(req.approve)
            .execute(&state.pool)
            .await?;
        }
        _ => {
            sqlx::query(
                "UPDATE permintaan_pembelian SET disetujui = $2, tgl_disetujui = NOW(), tgl_approved = CURRENT_DATE, status_approved = $3, approved = $3 WHERE no_pp = $1",
            )
            .bind(&no_pp)
            .bind(&auth.id_pegawai)
            .bind(req.approve)
            .execute(&state.pool)
            .await?;
        }
    }

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "purchasing.pp.approve",
        "permintaan_pembelian",
        Some(&no_pp),
        serde_json::json!({ "level": req.level, "approve": req.approve, "note": req.note }),
    )
    .await;

    let ev_type = if !req.approve {
        "purchasing.pp.rejected"
    } else if req.level == "spv" || req.level == "whm" {
        "purchasing.pp.step_approved"
    } else {
        "purchasing.pp.approved"
    };
    let ev = DomainEvent::new(
        ev_type,
        "permintaan_pembelian",
        &no_pp,
        serde_json::json!({ "no_pp": no_pp, "level": req.level, "approve": req.approve, "note": req.note }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    let action_url = format!(
        "/purchasing/requests/detail?id={}",
        utf8_percent_encode(&no_pp, NON_ALPHANUMERIC)
    );

    if !req.approve {
        mark_stage_action_taken(&state.pool, "permintaan_pembelian", &no_pp, &[]).await;
        if let Some(pid) = creator_pegawai.as_deref() {
            if let Some(creator_uname) = lookup_username_by_pegawai(&state.pool, pid).await {
                spawn_direct_notification(
                    state.pool.clone(),
                    state.notif_tx.clone(),
                    NotificationSpec {
                        event_id: Some(ev_id),
                        category: "approval_result".into(),
                        module: "purchasing.pp".into(),
                        stage: Some(req.level.clone()),
                        entity_type: "permintaan_pembelian".into(),
                        entity_id: no_pp.clone(),
                        document_number: no_pp.clone(),
                        title: format!("PP Ditolak: {}", no_pp),
                        message: format!(
                            "Permintaan Pembelian ditolak oleh {} (tahap {}).",
                            auth.username,
                            req.level.to_uppercase()
                        ),
                        action_url,
                        actor_username: auth.username.clone(),
                        actor_id_pegawai: Some(auth.id_pegawai.clone()),
                        amount: total,
                        metadata: serde_json::json!({ "level": req.level, "approve": false, "note": req.note }),
                    },
                    vec![creator_uname],
                );
            }
        }
    } else if req.level == "spv" {
        mark_stage_action_taken(&state.pool, "permintaan_pembelian", &no_pp, &["spv"]).await;
        spawn_stage_notification(
            state.pool.clone(),
            state.notif_tx.clone(),
            NotificationSpec {
                event_id: Some(ev_id),
                category: "approval_needed".into(),
                module: "purchasing.pp".into(),
                stage: Some("whm".into()),
                entity_type: "permintaan_pembelian".into(),
                entity_id: no_pp.clone(),
                document_number: no_pp.clone(),
                title: format!("PP Menunggu Verifikasi WHM: {}", no_pp),
                message: format!(
                    "Disetujui SPV ({}). Mohon verifikasi Warehouse Manager.",
                    auth.username
                ),
                action_url,
                actor_username: auth.username.clone(),
                actor_id_pegawai: creator_pegawai.clone(),
                amount: total,
                metadata: serde_json::json!({ "total": total, "prev_level": "spv" }),
            },
            vec!["whm".into()],
        );
    } else if req.level == "whm" {
        mark_stage_action_taken(&state.pool, "permintaan_pembelian", &no_pp, &["spv", "whm"]).await;
        spawn_stage_notification(
            state.pool.clone(),
            state.notif_tx.clone(),
            NotificationSpec {
                event_id: Some(ev_id),
                category: "approval_needed".into(),
                module: "purchasing.pp".into(),
                stage: Some("gm".into()),
                entity_type: "permintaan_pembelian".into(),
                entity_id: no_pp.clone(),
                document_number: no_pp.clone(),
                title: format!("PP Menunggu Approval GM/Direktur: {}", no_pp),
                message: format!(
                    "Diverifikasi WHM ({}). Est. Rp {:.0}. Mohon persetujuan final.",
                    auth.username, total
                ),
                action_url,
                actor_username: auth.username.clone(),
                actor_id_pegawai: creator_pegawai.clone(),
                amount: total,
                metadata: serde_json::json!({ "total": total, "prev_level": "whm" }),
            },
            vec!["gm".into()],
        );
    } else {
        // Final approval (GM / Director)
        mark_stage_action_taken(&state.pool, "permintaan_pembelian", &no_pp, &[]).await;
        if let Some(pid) = creator_pegawai.as_deref() {
            if let Some(creator_uname) = lookup_username_by_pegawai(&state.pool, pid).await {
                spawn_direct_notification(
                    state.pool.clone(),
                    state.notif_tx.clone(),
                    NotificationSpec {
                        event_id: Some(ev_id),
                        category: "approval_result".into(),
                        module: "purchasing.pp".into(),
                        stage: Some("gm".into()),
                        entity_type: "permintaan_pembelian".into(),
                        entity_id: no_pp.clone(),
                        document_number: no_pp.clone(),
                        title: format!("PP Disetujui: {}", no_pp),
                        message: format!(
                            "Permintaan Pembelian telah disetujui final oleh {}.",
                            auth.username
                        ),
                        action_url: action_url.clone(),
                        actor_username: auth.username.clone(),
                        actor_id_pegawai: Some(auth.id_pegawai.clone()),
                        amount: total,
                        metadata: serde_json::json!({ "total": total, "approve": true }),
                    },
                    vec![creator_uname],
                );
            }
        }
        spawn_stage_notification(
            state.pool.clone(),
            state.notif_tx.clone(),
            NotificationSpec {
                event_id: None,
                category: "action_needed".into(),
                module: "purchasing.pp".into(),
                stage: Some("purchasing_team".into()),
                entity_type: "permintaan_pembelian".into(),
                entity_id: no_pp.clone(),
                document_number: no_pp.clone(),
                title: format!("PP Approved — Siap Buat PO: {}", no_pp),
                message: format!(
                    "PP telah disetujui oleh {} (Est. Rp {:.0}) dan siap diproses menjadi PO.",
                    auth.username, total
                ),
                action_url,
                actor_username: auth.username.clone(),
                actor_id_pegawai: creator_pegawai,
                amount: total,
                metadata: serde_json::json!({ "total": total }),
            },
            vec!["purchasing_team".into()],
        );
    }

    get_request(State(state), auth, Path(no_pp)).await
}

async fn list_orders(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<PaginatedResponse<PurchaseOrderSummary>>> {
    let search = q.search_pattern();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM po a
        INNER JOIN supplier b ON a.id_supplier = b.id
        LEFT JOIN gudang c ON a.id_gudang = c.id_gudang
        WHERE ($1::text IS NULL OR a.nomor_po ILIKE $1 OR b.supplier ILIKE $1 OR COALESCE(a.keterangan,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_supplier = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'approved' AND a.is_approve = true)
              OR ($5 = 'rejected' AND (a.is_approve = false OR a.is_checked1 = false))
              OR ($5 = 'checked' AND a.is_checked1 = true AND a.is_approve IS NULL)
              OR ($5 = 'draft' AND a.is_checked1 IS NULL AND a.is_approve IS NULL)
          )
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_supplier)
    .bind(&q.status)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query_as::<_, PurchaseOrderSummary>(
        r#"
        SELECT a.id,
               a.nomor_po,
               a.tanggal,
               a.id_supplier,
               b.supplier AS nama_supplier,
               a.id_gudang,
               c.gudang,
               a.jenis_po,
               a.kode_mata_uang,
               a.is_ppn,
               a.is_pph,
               a.top,
               a.keterangan,
               a.shipto,
               a.referensi,
               COALESCE(a.total, 0)::float8 AS total,
               COALESCE(a.total_discount, 0)::float8 AS total_discount,
               COALESCE(a.total_ppn, 0)::float8 AS total_ppn,
               COALESCE(a.total_pph, 0)::float8 AS total_pph,
               (COALESCE(a.total, 0) - COALESCE(a.total_discount, 0) + COALESCE(a.total_ppn, 0) + COALESCE(a.total_pph, 0))::float8 AS grandtotal,
               a.is_checked1,
               a.is_approve,
               CASE
                   WHEN a.is_approve = true THEN 'Approved'
                   WHEN a.is_approve = false OR a.is_checked1 = false THEN 'Rejected'
                   WHEN a.is_checked1 = true THEN 'Checked'
                   ELSE 'Draft'
               END AS status_label,
               array_to_string(array(
                   SELECT DISTINCT j.no_intruksi_po
                   FROM po_intruksi_po i
                   INNER JOIN intruksi_po j ON i.id_intruksi_po = j.id
                   WHERE a.id = i.id_po
               ), ', ') AS no_intruksi_po
        FROM po a
        INNER JOIN supplier b ON a.id_supplier = b.id
        LEFT JOIN gudang c ON a.id_gudang = c.id_gudang
        WHERE ($1::text IS NULL OR a.nomor_po ILIKE $1 OR b.supplier ILIKE $1 OR COALESCE(a.keterangan,'') ILIKE $1)
          AND ($2::date IS NULL OR a.tanggal >= $2)
          AND ($3::date IS NULL OR a.tanggal <= $3)
          AND ($4::text IS NULL OR a.id_supplier = $4)
          AND (
              $5::text IS NULL
              OR ($5 = 'approved' AND a.is_approve = true)
              OR ($5 = 'rejected' AND (a.is_approve = false OR a.is_checked1 = false))
              OR ($5 = 'checked' AND a.is_checked1 = true AND a.is_approve IS NULL)
              OR ($5 = 'draft' AND a.is_checked1 IS NULL AND a.is_approve IS NULL)
          )
        ORDER BY a.tanggal DESC, a.id DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&search)
    .bind(q.from)
    .bind(q.to)
    .bind(&q.id_supplier)
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
    Path(id): Path<i32>,
) -> AppResult<Json<PurchaseOrderDetail>> {
    let header = sqlx::query_as::<_, PurchaseOrderSummary>(
        r#"
        SELECT a.id,
               a.nomor_po,
               a.tanggal,
               a.id_supplier,
               b.supplier AS nama_supplier,
               a.id_gudang,
               c.gudang,
               a.jenis_po,
               a.kode_mata_uang,
               a.is_ppn,
               a.is_pph,
               a.top,
               a.keterangan,
               a.shipto,
               a.referensi,
               COALESCE(a.total, 0)::float8 AS total,
               COALESCE(a.total_discount, 0)::float8 AS total_discount,
               COALESCE(a.total_ppn, 0)::float8 AS total_ppn,
               COALESCE(a.total_pph, 0)::float8 AS total_pph,
               (COALESCE(a.total, 0) - COALESCE(a.total_discount, 0) + COALESCE(a.total_ppn, 0) + COALESCE(a.total_pph, 0))::float8 AS grandtotal,
               a.is_checked1,
               a.is_approve,
               CASE
                   WHEN a.is_approve = true THEN 'Approved'
                   WHEN a.is_approve = false OR a.is_checked1 = false THEN 'Rejected'
                   WHEN a.is_checked1 = true THEN 'Checked'
                   ELSE 'Draft'
               END AS status_label,
               array_to_string(array(
                   SELECT DISTINCT j.no_intruksi_po
                   FROM po_intruksi_po i
                   INNER JOIN intruksi_po j ON i.id_intruksi_po = j.id
                   WHERE a.id = i.id_po
               ), ', ') AS no_intruksi_po
        FROM po a
        INNER JOIN supplier b ON a.id_supplier = b.id
        LEFT JOIN gudang c ON a.id_gudang = c.id_gudang
        WHERE a.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Purchase Order #{} tidak ditemukan", id)))?;

    let details = sqlx::query_as::<_, PurchaseOrderLineDto>(
        r#"
        SELECT d.urut,
               d.id_barang,
               b.nama_barang,
               COALESCE(d.qty, 0)::float8 AS qty,
               COALESCE(d.harga, 0)::float8 AS harga,
               COALESCE(d.diskonpersen, 0)::float8 AS diskonpersen,
               COALESCE(d.diskonrp, 0)::float8 AS diskonrp,
               COALESCE(d.total, 0)::float8 AS total,
               COALESCE(d.diambil, 0)::float8 AS diambil,
               COALESCE(d.sisa, 0)::float8 AS sisa
        FROM po_detail d
        LEFT JOIN barang b ON d.id_barang = b.id_barang
        WHERE d.id = $1
        ORDER BY d.urut
        "#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(PurchaseOrderDetail { header, details }))
}

async fn create_order(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreatePoRequest>,
) -> AppResult<Json<PurchaseOrderDetail>> {
    auth.require_role("ROLE_PO")?;
    if req.details.is_empty() {
        return Err(AppError::Validation("Minimal 1 baris barang wajib diisi".into()));
    }

    let nomor_po = next_po_number(&state.pool, req.tanggal).await?;
    let next_id: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(id), 0) + 1 FROM po")
        .fetch_one(&state.pool)
        .await?;

    let is_ppn = req.is_ppn.unwrap_or(true);
    let is_pph = req.is_pph.unwrap_or(false);

    let line_calcs: Vec<LineCalc> = req
        .details
        .iter()
        .map(|l| compute_line(l.qty, l.harga, l.diskonpersen.unwrap_or(0.0), None))
        .collect();

    let totals = compute_totals(&line_calcs, is_ppn, is_pph);

    let mut tx = state.pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO po (
            id, nomor_po, tanggal, id_supplier, id_gudang, jenis_po,
            kode_mata_uang, is_ppn, is_pph, top, keterangan, shipto, referensi,
            total, total_discount, total_ppn, total_pph,
            id_perusahaan, purchasing, is_purchasing, purchasing_date, create_date, status
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17,
            '01', $18, true, NOW(), NOW(), false
        )
        "#,
    )
    .bind(next_id)
    .bind(&nomor_po)
    .bind(req.tanggal)
    .bind(&req.id_supplier)
    .bind(&req.id_gudang)
    .bind(req.jenis_po.as_deref().unwrap_or("RG"))
    .bind(req.kode_mata_uang.as_deref().unwrap_or("IDR"))
    .bind(is_ppn)
    .bind(is_pph)
    .bind(req.top.unwrap_or(30))
    .bind(&req.keterangan)
    .bind(&req.shipto)
    .bind(&req.referensi)
    .bind(f64_to_dec(totals.total))
    .bind(f64_to_dec(totals.total_discount))
    .bind(f64_to_dec(totals.total_ppn))
    .bind(f64_to_dec(totals.total_pph))
    .bind(&auth.id_pegawai)
    .execute(&mut *tx)
    .await?;

    for (idx, (line, calc)) in req.details.iter().zip(line_calcs.iter()).enumerate() {
        let urut = (idx + 1) as i32;
        sqlx::query(
            r#"
            INSERT INTO po_detail (
                id, urut, id_barang, qty, harga, diskonpersen, diskonrp,
                total, diambil, sisa, invoice
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $4, 0)
            "#,
        )
        .bind(next_id)
        .bind(urut)
        .bind(&line.id_barang)
        .bind(f64_to_dec(line.qty))
        .bind(f64_to_dec(line.harga))
        .bind(f64_to_dec(line.diskonpersen.unwrap_or(0.0)))
        .bind(f64_to_dec(calc.diskon_rp))
        .bind(f64_to_dec(calc.net))
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "purchasing.po.create",
        "po",
        Some(&nomor_po),
        serde_json::json!({ "id": next_id, "grandtotal": totals.grandtotal }),
    )
    .await;

    let ev = DomainEvent::new(
        "purchasing.po.created",
        "po",
        &nomor_po,
        serde_json::json!({ "id": next_id, "nomor_po": nomor_po, "grandtotal": totals.grandtotal }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    spawn_stage_notification(
        state.pool.clone(),
        state.notif_tx.clone(),
        NotificationSpec {
            event_id: Some(ev_id),
            category: "approval_needed".into(),
            module: "purchasing.po".into(),
            stage: Some("check1".into()),
            entity_type: "po".into(),
            entity_id: next_id.to_string(),
            document_number: nomor_po.clone(),
            title: format!("PO Baru Menunggu Check (Level 1): {}", nomor_po),
            message: format!(
                "PO dibuat oleh {} (Rp {:.0}). Mohon pemeriksaan Level 1.",
                auth.username, totals.grandtotal
            ),
            action_url: format!("/purchasing/orders/detail?id={}", next_id),
            actor_username: auth.username.clone(),
            actor_id_pegawai: Some(auth.id_pegawai.clone()),
            amount: totals.grandtotal,
            metadata: serde_json::json!({ "id": next_id, "grandtotal": totals.grandtotal, "id_supplier": req.id_supplier }),
        },
        vec!["check1".into()],
    );

    get_order(State(state), auth, Path(next_id)).await
}

async fn check_order(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i32>,
    Json(req): Json<PoDecisionRequest>,
) -> AppResult<Json<PurchaseOrderDetail>> {
    auth.require_role("ROLE_PO")?;

    let po_meta: Option<(String, Option<String>, f64)> = sqlx::query_as(
        r#"
        SELECT nomor_po,
               purchasing,
               (COALESCE(total, 0) - COALESCE(total_discount, 0) + COALESCE(total_ppn, 0) + COALESCE(total_pph, 0))::float8
        FROM po
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;
    let (nomor_po, creator_pegawai, grandtotal) =
        po_meta.ok_or_else(|| AppError::NotFound("PO tidak ditemukan".into()))?;

    sqlx::query(
        r#"
        UPDATE po
        SET is_checked1 = $2,
            checked1 = $3,
            checked1_date = NOW()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(req.approve)
    .bind(&auth.id_pegawai)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "purchasing.po.check",
        "po",
        Some(&id.to_string()),
        serde_json::json!({ "approve": req.approve, "note": req.note }),
    )
    .await;

    let ev = DomainEvent::new(
        "purchasing.po.checked",
        "po",
        &nomor_po,
        serde_json::json!({ "id": id, "nomor_po": nomor_po, "approve": req.approve, "note": req.note }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    mark_stage_action_taken(&state.pool, "po", &id.to_string(), &["check1"]).await;

    let action_url = format!("/purchasing/orders/detail?id={}", id);
    if req.approve {
        spawn_stage_notification(
            state.pool.clone(),
            state.notif_tx.clone(),
            NotificationSpec {
                event_id: Some(ev_id),
                category: "approval_needed".into(),
                module: "purchasing.po".into(),
                stage: Some("director".into()),
                entity_type: "po".into(),
                entity_id: id.to_string(),
                document_number: nomor_po.clone(),
                title: format!("PO Menunggu Approval Direktur: {}", nomor_po),
                message: format!(
                    "Sudah diperiksa oleh {} (Rp {:.0}). Mohon persetujuan Direktur.",
                    auth.username, grandtotal
                ),
                action_url,
                actor_username: auth.username.clone(),
                actor_id_pegawai: creator_pegawai,
                amount: grandtotal,
                metadata: serde_json::json!({ "id": id, "grandtotal": grandtotal }),
            },
            vec!["director".into()],
        );
    } else if let Some(pid) = creator_pegawai.as_deref() {
        if let Some(creator_uname) = lookup_username_by_pegawai(&state.pool, pid).await {
            spawn_direct_notification(
                state.pool.clone(),
                state.notif_tx.clone(),
                NotificationSpec {
                    event_id: Some(ev_id),
                    category: "approval_result".into(),
                    module: "purchasing.po".into(),
                    stage: Some("check1".into()),
                    entity_type: "po".into(),
                    entity_id: id.to_string(),
                    document_number: nomor_po.clone(),
                    title: format!("PO Ditolak (Check Level 1): {}", nomor_po),
                    message: format!("PO ditolak saat pemeriksaan oleh {}.", auth.username),
                    action_url,
                    actor_username: auth.username.clone(),
                    actor_id_pegawai: Some(auth.id_pegawai.clone()),
                    amount: grandtotal,
                    metadata: serde_json::json!({ "id": id, "approve": false, "note": req.note }),
                },
                vec![creator_uname],
            );
        }
    }

    get_order(State(state), auth, Path(id)).await
}

async fn approve_order(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<i32>,
    Json(req): Json<PoDecisionRequest>,
) -> AppResult<Json<PurchaseOrderDetail>> {
    auth.require_role("ROLE_PO")?;

    let po_meta: Option<(String, Option<String>, f64)> = sqlx::query_as(
        r#"
        SELECT nomor_po,
               purchasing,
               (COALESCE(total, 0) - COALESCE(total_discount, 0) + COALESCE(total_ppn, 0) + COALESCE(total_pph, 0))::float8
        FROM po
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;
    let (nomor_po, creator_pegawai, grandtotal) =
        po_meta.ok_or_else(|| AppError::NotFound("PO tidak ditemukan".into()))?;

    let receipt_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM penerimaan WHERE nomor_po = $1 AND COALESCE(status, 'D') <> 'C'",
    )
    .bind(&nomor_po)
    .fetch_one(&state.pool)
    .await?;

    if receipt_count > 0 && !req.approve {
        return Err(AppError::Conflict(
            "PO sudah memiliki Penerimaan Barang aktif dan tidak dapat dibatalkan persetujuannya".into(),
        ));
    }

    sqlx::query(
        r#"
        UPDATE po
        SET is_checked1 = COALESCE(is_checked1, true),
            is_approve = $2,
            director = $3,
            approve_date = NOW(),
            tgl_approve = CURRENT_DATE
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(req.approve)
    .bind(&auth.id_pegawai)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "purchasing.po.approve",
        "po",
        Some(&nomor_po),
        serde_json::json!({ "id": id, "approve": req.approve, "note": req.note }),
    )
    .await;

    let ev = DomainEvent::new(
        "purchasing.po.approved",
        "po",
        &nomor_po,
        serde_json::json!({ "id": id, "nomor_po": nomor_po, "approve": req.approve }),
    );
    let ev_id = ev.id;
    emit_event(&state.pool, state.config.redis_url.as_deref(), ev).await;

    mark_stage_action_taken(&state.pool, "po", &id.to_string(), &[]).await;

    let action_url = format!("/purchasing/orders/detail?id={}", id);
    if let Some(pid) = creator_pegawai.as_deref() {
        if let Some(creator_uname) = lookup_username_by_pegawai(&state.pool, pid).await {
            spawn_direct_notification(
                state.pool.clone(),
                state.notif_tx.clone(),
                NotificationSpec {
                    event_id: Some(ev_id),
                    category: "approval_result".into(),
                    module: "purchasing.po".into(),
                    stage: Some("director".into()),
                    entity_type: "po".into(),
                    entity_id: id.to_string(),
                    document_number: nomor_po.clone(),
                    title: if req.approve {
                        format!("PO Disetujui Direktur: {}", nomor_po)
                    } else {
                        format!("PO Ditolak Direktur: {}", nomor_po)
                    },
                    message: format!(
                        "Purchase Order (Rp {:.0}) telah {} oleh {}.",
                        grandtotal,
                        if req.approve { "disetujui" } else { "ditolak" },
                        auth.username
                    ),
                    action_url: action_url.clone(),
                    actor_username: auth.username.clone(),
                    actor_id_pegawai: Some(auth.id_pegawai.clone()),
                    amount: grandtotal,
                    metadata: serde_json::json!({ "id": id, "approve": req.approve, "grandtotal": grandtotal }),
                },
                vec![creator_uname],
            );
        }
    }

    if req.approve {
        spawn_stage_notification(
            state.pool.clone(),
            state.notif_tx.clone(),
            NotificationSpec {
                event_id: None,
                category: "action_needed".into(),
                module: "purchasing.po".into(),
                stage: Some("warehouse".into()),
                entity_type: "po".into(),
                entity_id: id.to_string(),
                document_number: nomor_po.clone(),
                title: format!("PO Approved — Siap Penerimaan: {}", nomor_po),
                message: format!(
                    "PO disetujui Direktur ({}) senilai Rp {:.0}. Gudang dapat memproses penerimaan.",
                    auth.username, grandtotal
                ),
                action_url,
                actor_username: auth.username.clone(),
                actor_id_pegawai: creator_pegawai,
                amount: grandtotal,
                metadata: serde_json::json!({ "id": id, "grandtotal": grandtotal }),
            },
            vec!["warehouse".into()],
        );
    }

    get_order(State(state), auth, Path(id)).await
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/requests", get(list_requests).post(create_request))
        .route("/requests/{no_pp}", get(get_request))
        .route("/requests/{no_pp}/approve", post(approve_request))
        .route("/orders", get(list_orders).post(create_order))
        .route("/orders/{id}", get(get_order))
        .route("/orders/{id}/check", post(check_order))
        .route("/orders/{id}/approve", post(approve_order))
}
