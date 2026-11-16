# NEOCRA Backend API (Rust + Axum + SQLx)

High-performance, API-first backend for **NEOCRA (Corporate Resource Application)** built with Rust, Axum, Tokio, and SQLx over the existing CRA PostgreSQL database.

## Features
- **Zero-downtime coexistence** with legacy Java CRA: reads/writes legacy tables (`public`, `finance`, `hr`) with identical business rules, while keeping NEOCRA-specific tables (`user_credentials`, `audit_log`, `outbox_events`, `app_settings`) isolated in schema `neocra`.
- **Transparent Argon2 password upgrade**: verifies against `neocra.user_credentials` (Argon2id) or falls back to legacy `pengguna.passwordnya` (MD5) and upgrades automatically without breaking the old app.
- **Full ERP Modules**: Auth/RBAC, Company, Master Data, Inventory & Stock Card, Purchasing (PP & PO with Check/Approve workflow), Sales (SO & Invoices), Warehouse (Receipts & DO), Finance (COA, AR, AP, GL Journals, Cash), and Executive Dashboard Reporting.
- **OpenAPI 3 + Swagger UI**: Served at `/api-docs/openapi.json` and `/docs`.

## Running Locally

```bash
cp .env.example .env
cargo run
```

## Running Tests

```bash
cargo test
```
