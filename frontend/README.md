# NEOCRA Frontend (Next.js + TypeScript + Tailwind + shadcn/ui)

Web application for **NEOCRA ERP v1** built with Next.js App Router, TypeScript, Tailwind CSS, and TanStack Query.

## Modules & Routes
- `/login` — Authentication with Superadmin / RBAC support
- `/dashboard` — Executive KPIs, Pending Approvals (PP/PO/SO), 12-Month Sales & Purchase Trends, Top Customers & Products
- `/master/items`, `/master/suppliers`, `/master/customers`, `/master/employees` — Master Data management
- `/inventory/stock`, `/inventory/stock-card` — Warehouse stock & FIFO batch ledger (`stok_barang`)
- `/purchasing/requests` (+ `/new`, `/[no_pp]`), `/purchasing/orders` (+ `/new`, `/[id]`) — PP & PO creation and multi-level Check/Approve workflows
- `/sales/orders` (+ `/new`, `/[nomor]`), `/sales/invoices` (+ `/[no_penjualan]`) — Sales Orders & Invoices
- `/warehouse/receipts` (+ `/[no_penerimaan]`), `/warehouse/deliveries` (+ `/[nomor]`) — Goods Receipts & Delivery Orders
- `/finance/accounts`, `/finance/ar`, `/finance/ap`, `/finance/journals` (+ `/[gl_number]`), `/finance/cash` — COA Tree, AR, AP, General Ledger Journals, Cash

## Running Locally

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```
