import type { UserProfile } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  roles?: string[];
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const ERP_NAVIGATION: NavGroup[] = [
  {
    group: "Utama",
    items: [{ label: "Dashboard Eksekutif", href: "/dashboard" }],
  },
  {
    group: "Master Data",
    items: [
      { label: "Master Barang", href: "/master/items", roles: ["ROLE_BARANG", "ROLE_MASTER"] },
      { label: "Master Supplier", href: "/master/suppliers", roles: ["ROLE_SUPPLIER", "ROLE_MASTER"] },
      { label: "Master Customer", href: "/master/customers", roles: ["ROLE_CUSTOMER", "ROLE_MASTER"] },
      { label: "Data Pegawai", href: "/master/employees", roles: ["ROLE_PEGAWAI", "ROLE_HRD"] },
    ],
  },
  {
    group: "Persediaan (Inventory)",
    items: [
      { label: "Stok Gudang", href: "/inventory/stock", roles: ["ROLE_STOK", "ROLE_GUDANG"] },
      { label: "Kartu Stok (Ledger)", href: "/inventory/stock-card", roles: ["ROLE_KARTUSTOK", "ROLE_STOK"] },
    ],
  },
  {
    group: "Pembelian (Purchasing)",
    items: [
      { label: "Permintaan Pembelian (PP)", href: "/purchasing/requests", roles: ["ROLE_PERMINTAAN"] },
      { label: "Purchase Order (PO)", href: "/purchasing/orders", roles: ["ROLE_PO", "ROLE_MAINTENANCEPO"] },
    ],
  },
  {
    group: "Penjualan (Sales)",
    items: [
      { label: "Sales Order (SO)", href: "/sales/orders", roles: ["ROLE_SO", "ROLE_PENGAJUANSO"] },
      { label: "Invoice Penjualan", href: "/sales/invoices", roles: ["ROLE_INVOICE", "ROLE_INVOICEADMIN"] },
    ],
  },
  {
    group: "Gudang (Warehouse)",
    items: [
      { label: "Penerimaan Barang", href: "/warehouse/receipts", roles: ["ROLE_PENERIMAAN", "ROLE_PENERIMAANPO"] },
      { label: "Delivery Order (DO)", href: "/warehouse/deliveries", roles: ["ROLE_DO", "ROLE_TERIMADO"] },
    ],
  },
  {
    group: "Keuangan & Akuntansi",
    items: [
      { label: "Chart of Accounts (COA)", href: "/finance/accounts", roles: ["ROLE_ACCOUNT", "ROLE_ACCOUNTING"] },
      { label: "Piutang Usaha (AR)", href: "/finance/ar", roles: ["ROLE_AR", "ROLE_CUTOFAR"] },
      { label: "Hutang Usaha (AP)", href: "/finance/ap", roles: ["ROLE_AP", "ROLE_CUTOFAP"] },
      { label: "Jurnal Umum (GL)", href: "/finance/journals", roles: ["ROLE_JURNAL", "ROLE_JURNALUMUM"] },
      { label: "Kas & Bank", href: "/finance/cash", roles: ["ROLE_KASMASUK", "ROLE_KASKELUAR", "ROLE_ACCKAS"] },
    ],
  },
];

export function canAccessNav(user: UserProfile | null, item: NavItem): boolean {
  if (!user) return false;
  if (user.is_superadmin || user.roles.includes("ROLE_ADMIN")) return true;
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some((r) => user.roles.includes(r));
}
