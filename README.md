# NEOCRA — CRA ERP v1

**CRA (Corporate Resource Application)** is the ERP for a new business segment within the group. NEOCRA is its next-generation implementation: the same business logic as the legacy Java/JSF CRA application, rebuilt on an API-first, scalable, AI-ready and event-ready stack, running on the **existing CRA PostgreSQL database**.

| Layer | Technology |
|---|---|
| Web app | Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query/Table · react-hook-form + zod · recharts |
| API | Rust · Axum · Tokio · SQLx · Serde · validator · JWT · Argon2 · utoipa (OpenAPI) · tracing · thiserror · config |
| Data | PostgreSQL (`cra` database: `public`, `finance`, `hr` + NEOCRA schema `neocra`) |
| Events | Transactional outbox (`neocra.outbox_events`) → Redis pub/sub (optional) |

See [docs/architecture.md](docs/architecture.md), [docs/api-contract.md](docs/api-contract.md) and [docs/business-logic.md](docs/business-logic.md).

## Modules (phase 1)
- **Auth & RBAC** — legacy users (`pengguna`), permissions from `hakakses` → `menu.roles`, superadmin via `ROLE_ADMIN`
- **Company & Master data** — branches, warehouses, departments, positions, items, suppliers, customers, employees, lookups
- **Inventory** — stock per warehouse, stock card (from `stok_barang` ledger)
- **Purchasing** — Purchase Request (PP) with approval levels, Purchase Order (PO) with check/approve workflow
- **Sales** — Sales Order (SO), invoices (penjualan)
- **Warehouse** — goods receipts (penerimaan), delivery orders (DO)
- **Finance** — chart of accounts, AR, AP, journals (GL), cash
- **Reporting** — dashboard KPIs and trends

## Quick start (local)

Prerequisites: Rust stable (≥ 1.85), Node.js ≥ 20 + pnpm, PostgreSQL with the `cra` database restored.

```bash
# 1. Backend API → http://localhost:8080  (Swagger UI: http://localhost:8080/docs)
cd backend
cp .env.example .env        # set DATABASE_URL, JWT_SECRET
cargo run                   # runs SQLx migrations (schema neocra) on startup

# 2. Frontend → http://localhost:3000
cd ../frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8080
pnpm install
pnpm dev
```

Default login (created in the CRA database): `superadmin` / `superadmin123`.

## Docker

```bash
export DATABASE_URL='postgres://bdcpa:<url-encoded-password>@host.docker.internal:5432/cra'
docker compose up --build
```
This starts Redis, the API (port 8080) and the web app (port 3000). PostgreSQL is expected to be the existing CRA database on the host.

## Coexistence with legacy CRA
NEOCRA never alters legacy tables; it reads and writes them with the same rules, numbering and statuses as the Java application, so both apps can run side by side during migration. NEOCRA-owned objects live in the `neocra` schema.
