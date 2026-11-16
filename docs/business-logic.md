# NEOCRA Ported Business Logic Reference

This document maps the core business rules of legacy **CRA** (`net.sra.prime.ultima.*` in `/home/kotaromiyabi/CRA`) to **NEOCRA** (`backend/src/modules/*` and `backend/src/services/*`).

---

## 1. Document Numbering (`backend/src/services/numbering.rs`)

All transaction documents follow the Roman-month convention used across `ControllerPo`, `ControllerSo`, and `ControllerPermintaanPembelian`:
- Roman months: `I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII`
- Company initial (`internal_perusahaan.inisial`): `CRA`

| Document | Legacy Source | SQL Sequence Rule | Format | Example |
|---|---|---|---|---|
| **Purchase Order (PO)** | `MapperPo.SelectMax` (`MapperPo.java:194`) & `ControllerPo.nomorurut()` (`ControllerPo.java:799-816`) | `SELECT MAX(SUBSTR(nomor_po,1,3)) FROM po WHERE EXTRACT(year FROM tanggal) = $1` | `NNN/CRA-PO/<ROMAN>/<YYYY>` | `205/CRA-PO/VI/2026` |
| **Sales Order (SO)** | `MapperSo.SelectMax` (`MapperSo.java:215`) | `SELECT MAX(SUBSTR(nomor,1,3)) FROM so WHERE EXTRACT(month FROM tanggal) = $1 AND EXTRACT(year FROM tanggal) = $2` | `NNN/SO/CRA/<ROMAN>/<YYYY>` | `201/SO/CRA/VI/2026` |
| **Permintaan Pembelian (PP)** | `MapperPermintaanPembelian` | `SELECT MAX(SUBSTR(no_pp,1,3)) FROM permintaan_pembelian WHERE EXTRACT(year FROM tanggal) = $1` | `NNN/CRA/PP/<ROMAN>/<YYYY>` | `072/CRA/PP/VI/2026` |

---

## 2. Tax & Totals Calculation (`Purchasing` & `Sales`)

Ported from `ControllerPo.java` and `ControllerSo.java`:
1. **Line calculation**:
   - `line_gross = qty * harga`
   - `diskonrp = line_gross * (diskonpersen / 100.0)` (if `diskonpersen > 0`, else explicit `diskonrp`)
   - `line_total = line_gross - diskonrp`
2. **Header calculation**:
   - `total = SUM(line_gross)`
   - `total_discount = SUM(diskonrp) + header_discount`
   - `dpp = total - total_discount`
   - `total_ppn = is_ppn ? ROUND(dpp * 0.11, 2) : 0` (11% PPN rate per current Indonesian VAT rule in CRA 2025/2026)
   - `total_pph = is_pph ? ROUND(dpp * 0.02, 2) : 0` (2% PPh 23 when applicable on PO)
   - `grandtotal = dpp + total_ppn + total_pph`

---

## 3. Workflow & Status Mapping

### 3.1 Purchase Request / Permintaan Pembelian (`permintaan_pembelian`)
Legacy source: `ControllerPermintaanPembelian.java`, `ServicePermintaanPembelian.java`.
- Multi-stage approval columns:
  - `spv` (varchar), `spv_date` (timestamp), `spv_status` (bool) — Supervisor approval
  - `whm` (varchar), `whm_date` (timestamp), `whm_status` (bool) — Warehouse Manager verification
  - `gm` (varchar), `gm_date` (timestamp), `gm_status` (bool) — General Manager / Director approval
  - `status_approved` (bool), `disetujui` (varchar), `tgl_disetujui` (timestamp) — Final approval
- Exposed `status_label`:
  - `status_approved == Some(true)` or `gm_status == Some(true)` → `"Approved"`
  - `status_approved == Some(false)` or `spv_status == Some(false)` or `gm_status == Some(false)` → `"Rejected"`
  - `whm_status == Some(true)` or `spv_status == Some(true)` → `"Checked"`
  - Otherwise → `"Pending"`

### 3.2 Purchase Order (`po` & `po_detail`)
Legacy source: `ControllerPo.java:136, 224, 697, 1142-1160`, `ProviderPo.java`.
- Primary key: `po.id` (integer `MAX(id) + 1`), business key: `po.nomor_po`.
- `po_detail` links via `id = po.id` and tracks `qty`, `diambil` (received qty), `sisa = qty - diambil`.
- Approval workflow:
  1. **Draft**: `is_purchasing = true`, `is_checked1 = None`, `is_approve = None` → `status_label = "Draft"`
  2. **Checked**: `POST /purchasing/orders/{id}/check` sets `is_checked1 = Some(approve)`, `checked1 = user.id_pegawai`, `checked1_date = NOW()` → `status_label = "Checked"` (or `"Rejected"` if `false`)
  3. **Approved / Rejected**: `POST /purchasing/orders/{id}/approve` sets `is_approve = Some(approve)`, `director = user.id_pegawai`, `approve_date = NOW()`, `tgl_approve = TODAY()`.
  4. **Guard rule** (`ControllerPo.java:697, 1143`): If a goods receipt (`penerimaan`) with `nomor_po = po.nomor_po` and `status != 'C'` already exists, changing approval status is rejected with `409 CONFLICT`.

### 3.3 Sales Order (`so` & `so_detail`)
Legacy source: `ControllerSo.java`, `MapperSo.java`.
- Status codes (`so.status`):
  - `'D'` → `"Draft"`
  - `'S'` → `"Send / Submitted"`
  - `'P'` → `"Processed (Packing List)"`
  - `'C'` → `"Cancelled"`
  - `'R'` → `"Rejected"`

### 3.4 Inventory Ledger (`stok_barang`)
Legacy source: `ServiceStokBarangBaru.java`, `ServiceLaporanStok.java`.
- `stok_barang` is a FIFO/batch stock ledger:
  - `persediaan`: initial inbound quantity for that batch/receipt
  - `stok`: remaining quantity currently available in that batch
  - `hpp`: unit cost of goods sold
  - `reff`: reference document number (e.g., BTB/Penerimaan, IT/Internal Transfer, Opname)
- Current warehouse stock for `(id_gudang, id_barang)` = `SUM(stok) FROM stok_barang WHERE id_gudang = $1 AND id_barang = $2`.

---

## 4. Authentication & RBAC Coexistence
Legacy source: `SecurityConfig.java:47-53`, `CustomSuccessHandler.java`.
- Legacy `pengguna.passwordnya` stores `md5(plaintext)`.
- NEOCRA verifies against `neocra.user_credentials` (Argon2id) first; if no entry exists, it verifies `md5(plaintext) == pengguna.passwordnya` and transparently upgrades the user by inserting an Argon2id hash into `neocra.user_credentials` without altering `pengguna.passwordnya`.
- User authorities are loaded from `SELECT DISTINCT c.roles FROM hakakses b INNER JOIN menu c ON b.id_menu = c.id WHERE b.usernamenya = $1 AND c.roles IS NOT NULL AND c.roles <> ''`.
- Superadmin bypasses role checks when `pengguna.roles == 'ROLE_ADMIN'` or `authorities` contains `'ROLE_ADMIN'`.
