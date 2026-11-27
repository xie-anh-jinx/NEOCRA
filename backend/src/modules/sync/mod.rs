use crate::{
    app::AppState,
    auth::AuthUser,
    services::audit::write_audit_log,
    utils::{AppError, AppResult},
};
use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize)]
pub struct DeltaQuery {
    pub entity: String,
    pub since: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DeltaResponse {
    pub entity: String,
    pub server_time: String,
    pub count: usize,
    pub rows: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncAckRequest {
    pub idempotency_key: String,
    pub entity: String,
    pub method: String,
    pub path: String,
    pub response_status: i32,
    pub response_body: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SyncAckResponse {
    pub ok: bool,
    pub duplicate: bool,
}

async fn fetch_table_json(
    pool: &sqlx::PgPool,
    sql: &str,
    limit: i64,
) -> AppResult<Vec<serde_json::Value>> {
    let rows: Vec<serde_json::Value> = sqlx::query_scalar(sql)
        .bind(limit)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn delta_handler(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(q): Query<DeltaQuery>,
) -> AppResult<Json<DeltaResponse>> {
    let limit = q.limit.unwrap_or(500).clamp(1, 2000);
    let entity = q.entity.trim().to_lowercase();

    let rows = match entity.as_str() {
        "barang" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT id_barang, nama_barang, id_satuan_kecil, id_satuan_besar, isi_satuan, status FROM barang ORDER BY id_barang LIMIT $1) t",
                limit,
            )
            .await?
        }
        "customer" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT id_customer, customer, alamat, telepon, email, top, is_aktif FROM customer ORDER BY id_customer LIMIT $1) t",
                limit,
            )
            .await?
        }
        "supplier" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT id_supplier, supplier, alamat, telepon, email, top FROM supplier ORDER BY id_supplier LIMIT $1) t",
                limit,
            )
            .await?
        }
        "gudang" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT id_gudang, gudang, id_kantor FROM gudang ORDER BY id_gudang LIMIT $1) t",
                limit,
            )
            .await?
        }
        "stok_barang" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT id_gudang, id_barang, stok, batch FROM stok_barang WHERE COALESCE(stok, 0) <> 0 ORDER BY id_gudang, id_barang LIMIT $1) t",
                limit,
            )
            .await?
        }
        "permintaan_pembelian" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT no_pp, tanggal, pembuat, keterangan, status_approved, gm_status FROM permintaan_pembelian ORDER BY tanggal DESC NULLS LAST, no_pp DESC LIMIT $1) t",
                limit,
            )
            .await?
        }
        "po" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT id, nomor_po, tanggal, id_supplier, total, grandtotal, is_checked1, is_approve FROM po ORDER BY tanggal DESC NULLS LAST, id DESC LIMIT $1) t",
                limit,
            )
            .await?
        }
        "so" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT nomor, tanggal, id_customer, grandtotal, status FROM so ORDER BY tanggal DESC NULLS LAST, nomor DESC LIMIT $1) t",
                limit,
            )
            .await?
        }
        "penjualan" => {
            fetch_table_json(
                &state.pool,
                "SELECT to_jsonb(t) FROM (SELECT no_penjualan, tanggal, id_customer, grandtotal, status FROM penjualan ORDER BY tanggal DESC NULLS LAST, no_penjualan DESC LIMIT $1) t",
                limit,
            )
            .await?
        }
        _ => {
            return Err(AppError::Validation(format!(
                "Entity sinkronisasi '{}' tidak dikenal",
                q.entity
            )));
        }
    };

    let count = rows.len();
    Ok(Json(DeltaResponse {
        entity,
        server_time: chrono::Utc::now().to_rfc3339(),
        count,
        rows,
    }))
}

pub async fn ack_outbox_handler(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<SyncAckRequest>,
) -> AppResult<Json<SyncAckResponse>> {
    let existing: Option<String> = sqlx::query_scalar(
        "SELECT idempotency_key FROM neocra.sync_idempotency WHERE idempotency_key = $1",
    )
    .bind(&req.idempotency_key)
    .fetch_optional(&state.pool)
    .await?;

    if existing.is_some() {
        return Ok(Json(SyncAckResponse {
            ok: true,
            duplicate: true,
        }));
    }

    sqlx::query(
        r#"
        INSERT INTO neocra.sync_idempotency (idempotency_key, username, entity, method, path, response_status, response_body)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (idempotency_key) DO NOTHING
        "#,
    )
    .bind(&req.idempotency_key)
    .bind(&auth.username)
    .bind(&req.entity)
    .bind(&req.method)
    .bind(&req.path)
    .bind(req.response_status)
    .bind(&req.response_body)
    .execute(&state.pool)
    .await?;

    write_audit_log(
        &state.pool,
        Some(&auth.username),
        "sync.outbox_ack",
        &req.entity,
        Some(&req.idempotency_key),
        serde_json::json!({ "method": req.method, "path": req.path, "status": req.response_status }),
    )
    .await;

    Ok(Json(SyncAckResponse {
        ok: true,
        duplicate: false,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/delta", get(delta_handler))
        .route("/ack", post(ack_outbox_handler))
}
