export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface UserProfile {
  username: string;
  nama: string;
  id_pegawai: string;
  is_superadmin: boolean;
  roles: string[];
  jabatan: string | null;
  id_jabatan: number | null;
  departemen: string | null;
  id_departemen: number | null;
  id_kantor: string | null;
  kantor: string | null;
  branches: string[];
  warehouses: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

export interface MenuNode {
  id: number;
  name: string;
  icon: string | null;
  outcome: string | null;
  urut: number | null;
  roles: string | null;
  children: MenuNode[];
}

export interface DashboardResponse {
  pending: {
    purchase_requests: number;
    purchase_orders: number;
    sales_orders: number;
  };
  this_month: {
    sales_orders_count: number;
    sales_orders_value: number;
    invoices_value: number;
    purchase_orders_value: number;
  };
  outstanding: {
    ar: number;
    ap: number;
  };
  sales_trend: { month: string; total: number }[];
  purchase_trend: { month: string; total: number }[];
  top_customers: { id_customer: string; customer: string; total: number }[];
  top_items: { id_barang: string; nama_barang: string; qty: number }[];
}

export interface ItemDto {
  id_barang: string;
  nama_barang: string;
  nama_alias: string | null;
  id_kategori_barang: string;
  kategori_barang: string | null;
  id_satuan_besar: string;
  satuan_besar: string | null;
  id_satuan_kecil: string;
  satuan_kecil: string | null;
  isi_satuan: number;
  id_family: string | null;
  family: string | null;
  id_brand: number | null;
  brand: string | null;
  barcode: string | null;
  berat: number | null;
  status: boolean | null;
  keterangan: string | null;
}

export interface SupplierDto {
  id: string;
  supplier: string;
  npwp: string | null;
  telepon: string | null;
  fax: string | null;
  email: string | null;
  alamat: string | null;
  id_kategori_supplier: number | null;
  nm_kategori_supplier: string | null;
  bank: string | null;
  kena_pajak: boolean | null;
  isaktif: boolean | null;
  top: number | null;
  batas_kredit: number | null;
}

export interface CustomerDto {
  id_kontak: string;
  customer: string;
  no_npwp: string | null;
  telepon: string | null;
  email: string | null;
  alamat_penagihan: string | null;
  alamat_kirim: string | null;
  id_kategori_customer: number | null;
  kena_pajak: boolean | null;
  isaktif: boolean | null;
  batas_kredit: number | null;
  top: number | null;
  id_kantor: string | null;
  id_sales: string | null;
  nama_sales: string | null;
}

export interface EmployeeDto {
  id_pegawai: string;
  nama: string;
  nip: string | null;
  email: string | null;
  hp: string | null;
  id_jabatan_new: number | null;
  jabatan: string | null;
  id_departemen_new: number | null;
  departemen: string | null;
  id_kantor_new: string | null;
  kantor: string | null;
  status: boolean | null;
}

export interface WarehouseItem {
  id_gudang: string;
  gudang: string;
  id_kantor: string | null;
  alamat: string | null;
  telpon: string | null;
  inisial: string | null;
}

export interface StockRow {
  id_gudang: string;
  gudang: string | null;
  id_barang: string;
  nama_barang: string | null;
  satuan: string | null;
  qty: number;
  nilai: number;
}

export interface StockCardMovement {
  id_stok: number;
  tanggal: string;
  id_gudang: string;
  id_barang: string;
  reff: string | null;
  persediaan: number;
  stok: number;
  hpp: number;
  batch: string | null;
}

export interface PurchaseRequestSummary {
  no_pp: string;
  tanggal: string;
  dibuat: string | null;
  nama_pembuat: string | null;
  keterangan: string | null;
  jenis: string | null;
  total: number;
  spv_status: boolean | null;
  gm_status: boolean | null;
  whm_status: boolean | null;
  status_approved: boolean | null;
  status_label: string;
}

export interface PurchaseRequestDetailLine {
  urut: number;
  id_barang: string;
  nama_barang: string | null;
  keperluan: string | null;
  spesifikasi: string | null;
  jumlah_order: number;
  jumlah_stok: number | null;
  satuan: string | null;
  harga: number;
  amount: number;
  tanggal_dibutuhkan: string | null;
  keterangan: string | null;
}

export interface PurchaseRequestDetail extends PurchaseRequestSummary {
  details: PurchaseRequestDetailLine[];
}

export interface PurchaseOrderSummary {
  id: number;
  nomor_po: string;
  tanggal: string;
  id_supplier: string;
  nama_supplier: string | null;
  id_gudang: string | null;
  gudang: string | null;
  jenis_po: string | null;
  kode_mata_uang: string | null;
  is_ppn: boolean | null;
  is_pph: boolean | null;
  top: number | null;
  keterangan: string | null;
  shipto: string | null;
  referensi: string | null;
  total: number;
  total_discount: number;
  total_ppn: number;
  total_pph: number;
  grandtotal: number;
  is_checked1: boolean | null;
  is_approve: boolean | null;
  status_label: string;
  no_intruksi_po: string | null;
}

export interface PurchaseOrderLineDto {
  urut: number;
  id_barang: string;
  nama_barang: string | null;
  qty: number;
  harga: number;
  diskonpersen: number;
  diskonrp: number;
  total: number;
  diambil: number;
  sisa: number;
}

export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  details: PurchaseOrderLineDto[];
}

export interface SalesOrderSummary {
  nomor: string;
  tanggal: string | null;
  id_customer: string | null;
  customer: string | null;
  id_salesman: string | null;
  nama_salesman: string | null;
  id_gudang: string | null;
  gudang: string | null;
  referensi: string | null;
  deliverypoint: string | null;
  top: number | null;
  is_ppn: boolean | null;
  total: number;
  total_discount: number;
  dpp: number;
  total_ppn: number;
  grandtotal: number;
  status: string | null;
  status_label: string;
}

export interface SalesOrderLineDto {
  urut: number;
  id_barang: string | null;
  nama_barang: string | null;
  id_gudang: string | null;
  qty: number;
  harga: number;
  diskonpersen: number;
  diskonrp: number;
  total: number;
  diambil: number;
  sisa: number;
  delivery_date: string | null;
  remark: string | null;
}

export interface SalesOrderDetail extends SalesOrderSummary {
  details: SalesOrderLineDto[];
}

export interface SalesInvoiceSummary {
  no_penjualan: string;
  tanggal: string | null;
  id_customer: string | null;
  customer: string | null;
  no_do: string | null;
  faktur: string | null;
  total: number;
  total_discount: number;
  dpp: number;
  total_ppn: number;
  grandtotal: number;
  total_bayar: number;
  is_lunas: string | null;
  tgl_jatuh_tempo: string | null;
  status: string | null;
}

export interface SalesInvoiceDetail extends SalesInvoiceSummary {
  details: {
    urut: number;
    id_barang: string | null;
    nama_barang: string | null;
    id_gudang: string | null;
    qty: number;
    harga: number;
    diskonpersen: number;
    diskonrp: number;
    total: number;
  }[];
}

export interface GoodsReceiptSummary {
  no_penerimaan: string;
  tgl_penerimaan: string | null;
  id_supplier: string | null;
  supplier: string | null;
  id_gudang: string | null;
  gudang: string | null;
  nomor_po: string | null;
  referensi: string | null;
  grandtotal: number;
  status: string | null;
}

export interface GoodsReceiptDetail extends GoodsReceiptSummary {
  details: {
    urut: number;
    id_barang: string | null;
    nama_barang: string | null;
    qty: number;
    harga: number;
    total: number;
  }[];
}

export interface DeliveryOrderSummary {
  nomor: string;
  tanggal: string | null;
  id_customer: string | null;
  customer: string | null;
  id_gudang: string | null;
  gudang: string | null;
  no_pl: string | null;
  driver: string | null;
  lic_plate: string | null;
  status: string | null;
  received_date: string | null;
  received_name: string | null;
}

export interface DeliveryOrderDetail extends DeliveryOrderSummary {
  details: {
    urut: number;
    id_barang: string | null;
    nama_barang: string | null;
    qty: number;
    qty_diterima: number;
    keterangan: string | null;
    kemasan: string | null;
  }[];
}

export interface AccountNode {
  id_account: number;
  account: string;
  parent: number | null;
  level: number | null;
  aktif: boolean | null;
  children: AccountNode[];
}

export interface ArInvoiceRow {
  ar_number: string;
  ar_date: string | null;
  customer_code: string | null;
  customer: string | null;
  no_invoice: string | null;
  total: number;
  bayar: number;
  outstanding: number;
  due_date: string | null;
  status: string | null;
}

export interface ApInvoiceRow {
  ap_number: string;
  ap_date: string | null;
  vendor_code: string | null;
  supplier: string | null;
  po_number: string | null;
  reff: string | null;
  total: number;
  bayar: number;
  outstanding: number;
  due_date: string | null;
  status: string | null;
}

export interface JournalSummary {
  gl_number: string;
  gl_date: string;
  journal_code: string | null;
  note: string | null;
  reference: string | null;
  jumlah: number;
  posting: boolean | null;
}

export interface JournalDetail extends JournalSummary {
  lines: {
    line: number;
    id_account: number | null;
    account: string | null;
    is_debit: boolean | null;
    value: number;
    keterangan: string | null;
  }[];
}

export interface CashTransactionRow {
  nomor: string;
  tanggal: string;
  id_jenis_transaksi: string | null;
  id_kantor: string;
  uraian: string | null;
  total: number;
  kepada: string | null;
  status: string;
}
