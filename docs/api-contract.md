# NEOCRA API Contract v1

Base URL: `http://localhost:8080/api/v1` (configurable). All payloads are JSON (snake_case keys, matching legacy column names where possible so business meaning stays identical to CRA).

## Conventions

| Topic | Rule |
|---|---|
| Auth | `Authorization: Bearer <jwt>` on every endpoint except `/health`, `/auth/login`, `/docs`, `/api-docs/*` |
| List response | `{ "data": [...], "meta": { "page": 1, "per_page": 25, "total": 1234 } }` |
| List query | `page` (default 1), `per_page` (default 25, max 200), `q` (free-text search), `from` / `to` (ISO date `YYYY-MM-DD`) + endpoint specific filters |
| Single response | the object itself |
| Error response | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` with codes `BAD_REQUEST`, `VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL` |
| Numbers | Postgres `numeric` is serialized as a JSON **number** (f64-safe) |
| Dates | `YYYY-MM-DD`; timestamps ISO-8601 `YYYY-MM-DDTHH:MM:SS` |
| Document numbers with `/` | Legacy numbers like `199/SO/CRA/VI/2026` are passed in the path **URL-encoded** (`encodeURIComponent`) e.g. `/sales/orders/199%2FSO%2FCRA%2FVI%2F2026` |
| Permissions | Derived from legacy `hakakses` → `menu.roles` (e.g. `ROLE_PO`). `pengguna.roles = 'ROLE_ADMIN'` = superadmin, bypasses all checks |

## System
- `GET /health` → `{ "status": "ok", "database": "ok", "redis": "disabled|ok|error", "version": "0.1.0" }` (mounted at root `/health`, not under `/api/v1`)
- `GET /api-docs/openapi.json` → OpenAPI 3 spec (utoipa)
- `GET /docs` → Swagger UI

## Auth (`/auth`)
- `POST /auth/login` body `{ "username": "superadmin", "password": "..." }` →
  `{ "access_token": "...", "token_type": "Bearer", "expires_in": 28800, "user": UserProfile }`
- `GET /auth/me` → `UserProfile`
- `GET /auth/menus` → `MenuNode[]` (tree of menus the user may access, ordered by `urut`)
- `POST /auth/change-password` body `{ "old_password", "new_password" }` → `{ "ok": true }`

```ts
type UserProfile = {
  username: string; nama: string; id_pegawai: string;
  is_superadmin: boolean; roles: string[];
  jabatan: string | null; id_jabatan: number | null;
  departemen: string | null; id_departemen: number | null;
  id_kantor: string | null; kantor: string | null;
  branches: string[];   // map_pengguna_cabang.id_kantor_cabang
  warehouses: string[]; // map_pengguna_gudang.id_gudang
};
type MenuNode = { id: number; name: string; icon: string | null; outcome: string | null; urut: number | null; roles: string | null; children: MenuNode[] };
```

## Company (`/company`)
- `GET /company/profile` → internal_perusahaan row
- `GET /company/branches` → internal_kantor_cabang[]
- `GET /company/warehouses?id_kantor=` → gudang[] (`id_gudang, gudang, id_kantor, alamat, telpon, inisial`)
- `GET /company/departments` → hr_departemen[]
- `GET /company/positions` → master_jabatan[]

## Master data (`/master`)
| Resource | Endpoints | Key | Main fields |
|---|---|---|---|
| items (barang) | `GET /master/items`, `GET /master/items/{id_barang}`, `POST`, `PUT /{id_barang}` | `id_barang` | `nama_barang, nama_alias, id_kategori_barang, kategori_barang, id_satuan_besar, satuan_besar, id_satuan_kecil, satuan_kecil, isi_satuan, id_family, family, id_brand, brand, barcode, berat, status, keterangan` (filters: `id_kategori_barang`, `status`) |
| suppliers | `GET/POST /master/suppliers`, `GET/PUT /master/suppliers/{id}` | `id` | `supplier, npwp, telepon, fax, email, alamat, id_kategori_supplier, nm_kategori_supplier, bank, kena_pajak, isaktif, top, batas_kredit` |
| customers | `GET/POST /master/customers`, `GET/PUT /master/customers/{id_kontak}` | `id_kontak` | `customer, no_npwp, telepon, email, alamat_penagihan, alamat_kirim, id_kategori_customer, kena_pajak, isaktif, batas_kredit, top, id_kantor, id_sales, nama_sales` |
| employees (pegawai) | `GET /master/employees`, `GET /master/employees/{id_pegawai}` | `id_pegawai` | `nama, nip, email, hp, id_jabatan_new, jabatan, id_departemen_new, departemen, id_kantor_new, status` |
| lookups | `GET /master/units`, `GET /master/categories`, `GET /master/brands`, `GET /master/families`, `GET /master/supplier-categories`, `GET /master/customer-categories`, `GET /master/currencies` | | `units` returns `{ "besar": [...], "kecil": [...] }` |

## Inventory (`/inventory`)
- `GET /inventory/stock?id_gudang=&q=&only_available=true` → paginated `{ id_gudang, gudang, id_barang, nama_barang, satuan, qty, nilai }` where `qty = SUM(stok_barang.stok)` per gudang+barang
- `GET /inventory/stock/{id_barang}` → per-warehouse breakdown `{ id_barang, nama_barang, total_qty, warehouses: [{id_gudang, gudang, qty}] }`
- `GET /inventory/stock-card?id_barang=&id_gudang=&from=&to=` → movement rows `{ tanggal, reff, persediaan (qty in), stok (remaining), hpp, batch }`

## Purchasing (`/purchasing`)
### Purchase Requests – Permintaan Pembelian (PP)
- `GET /purchasing/requests?from=&to=&status=pending|approved|rejected&jenis=` → `{ no_pp, tanggal, dibuat, nama_pembuat, keterangan, jenis, total, spv_status, gm_status, whm_status, status_approved, status_label }`
- `GET /purchasing/requests/{no_pp}` → header + `details: [{ urut, id_barang, nama_barang, keperluan, spesifikasi, jumlah_order, jumlah_stok, satuan, harga, amount, tanggal_dibutuhkan, keterangan, id_departemen, id_kantor }]`
- `POST /purchasing/requests` body `{ tanggal, jenis, keterangan, details: [...] }` → created (number auto-generated, legacy format `NNN/CRA/PP/<ROMAN_MONTH>/<YEAR>`)
- `POST /purchasing/requests/{no_pp}/approve` body `{ "level": "spv"|"gm"|"whm"|"final", "approve": true, "note": "..." }`

### Purchase Orders (PO)
- `GET /purchasing/orders?from=&to=&id_supplier=&status=draft|checked|approved|rejected` → `{ id, nomor_po, tanggal, id_supplier, nama_supplier, id_gudang, gudang, jenis_po, total, total_discount, total_ppn, total_pph, grandtotal, is_checked1, is_approve, status_label, no_intruksi_po }`
- `GET /purchasing/orders/{id}` (integer `po.id`) → header + `details: [{ urut, id_barang, nama_barang, qty, harga, diskonpersen, diskonrp, total, diambil, sisa }]`
- `POST /purchasing/orders` body `{ tanggal, id_supplier, id_gudang, jenis_po, kode_mata_uang, is_ppn, is_pph, top, keterangan, shipto, referensi, details: [{ id_barang, qty, harga, diskonpersen }] }` → created (number `NNN/<INISIAL>-PO/<ROMAN_MONTH>/<YEAR>`, totals computed server-side)
- `POST /purchasing/orders/{id}/check` body `{ "approve": true, "note": "" }` (check level 1)
- `POST /purchasing/orders/{id}/approve` body `{ "approve": true, "note": "" }` (director approval; rejected if goods already received)

## Sales (`/sales`)
- `GET /sales/orders?from=&to=&id_customer=&status=` → `{ nomor, tanggal, id_customer, customer, id_salesman, nama_salesman, id_gudang, total, total_discount, total_ppn, grandtotal, status, status_label }`
- `GET /sales/orders/{nomor}` → header + `details: [{ urut, id_barang, nama_barang, id_gudang, qty, harga, diskonpersen, diskonrp, total, diambil, sisa, delivery_date, remark }]`
- `POST /sales/orders` body `{ tanggal, id_customer, id_salesman, id_gudang, is_ppn, top, keterangan, referensi, deliverypoint, details: [{ id_barang, qty, harga, diskonpersen }] }` (number `NNN/SO/CRA/<ROMAN_MONTH>/<YEAR>`)
- `POST /sales/orders/{nomor}/status` body `{ "status": "S" }`
- `GET /sales/invoices?from=&to=&id_customer=` (penjualan) → `{ no_penjualan, tanggal, id_customer, customer, no_do, grandtotal, total_bayar, is_lunas, tgl_jatuh_tempo, status }`
- `GET /sales/invoices/{no_penjualan}` → header + details

## Warehouse (`/warehouse`)
- `GET /warehouse/receipts?from=&to=&id_gudang=` (penerimaan) → `{ no_penerimaan, tgl_penerimaan, id_supplier, supplier, id_gudang, gudang, nomor_po, grandtotal, status }`
- `GET /warehouse/receipts/{no_penerimaan}` → header + details
- `GET /warehouse/deliveries?from=&to=&id_gudang=` (do_tbl) → `{ nomor, tanggal, id_customer, customer, id_gudang, gudang, no_pl, driver, status, received_date }`
- `GET /warehouse/deliveries/{nomor}` → header + details

## Finance (`/finance`)
- `GET /finance/accounts` → chart of accounts tree `{ id_account, account, parent, level, aktif, children }`
- `GET /finance/ar?from=&to=&status=open|paid&customer_code=` (acc_ar_faktur) → `{ ar_number, ar_date, customer_code, customer, no_invoice, total, bayar, outstanding, due_date, status }`
- `GET /finance/ap?from=&to=&status=open|paid&vendor_code=` (acc_ap_faktur) → `{ ap_number, ap_date, vendor_code, supplier, total, bayar, outstanding, due_date, status }`
- `GET /finance/journals?from=&to=&journal_code=` (acc_gl_trans) → `{ gl_number, gl_date, journal_code, note, reference, jumlah, posting }`
- `GET /finance/journals/{gl_number}` → header + `lines: [{ line, id_account, account, is_debit, value, keterangan }]`
- `GET /finance/cash?from=&to=` (acc_kas) → `{ nomor, tanggal, id_jenis_transaksi, uraian, total, kepada, status }`

## Reporting (`/reporting`)
- `GET /reporting/dashboard` →
```json
{
  "pending": { "purchase_requests": 0, "purchase_orders": 0, "sales_orders": 0 },
  "this_month": { "sales_orders_count": 0, "sales_orders_value": 0, "invoices_value": 0, "purchase_orders_value": 0 },
  "outstanding": { "ar": 0, "ap": 0 },
  "sales_trend": [ { "month": "2026-01", "total": 0 } ],
  "purchase_trend": [ { "month": "2026-01", "total": 0 } ],
  "top_customers": [ { "id_customer": "...", "customer": "...", "total": 0 } ],
  "top_items": [ { "id_barang": "...", "nama_barang": "...", "qty": 0 } ]
}
```
  Trend = last 12 months ending at the latest transaction month in the DB (data ends mid-2026).

## Platform tables (NEOCRA-owned, schema `neocra`, created by SQLx migrations — legacy tables are never altered)
- `neocra.user_credentials(username PK, password_hash argon2, updated_at)` — on first successful legacy MD5 login the password is re-hashed with Argon2 and stored here; afterwards Argon2 is preferred. Legacy `pengguna.passwordnya` is **not** modified, so the old CRA app keeps working.
- `neocra.audit_log(id, occurred_at, username, action, entity, entity_id, payload jsonb, ip)`
- `neocra.outbox_events(id uuid, occurred_at, event_type, aggregate, aggregate_id, payload jsonb, published_at)` — event-ready (e.g. `purchasing.po.created`, `purchasing.po.approved`, `sales.so.created`); published to Redis channel `neocra.events` when Redis is configured.
- `neocra.app_settings(key PK, value jsonb)`
