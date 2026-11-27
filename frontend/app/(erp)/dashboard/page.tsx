"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type {
  DashboardResponse,
  PaginatedResponse,
  SalesOrderSummary,
} from "@/types";
import { formatDateID, formatIDR, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Boxes,
  ClipboardList,
  CreditCard,
  Package,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reporting-dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/reporting/dashboard"),
  });

  const { data: recentSo } = useQuery({
    queryKey: ["recent-sales-orders"],
    queryFn: () =>
      apiFetch<PaginatedResponse<SalesOrderSummary>>(
        "/sales/orders",
        {},
        { page: 1, per_page: 5 }
      ),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/80" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={18} />
          <span>Gagal memuat data dashboard</span>
        </div>
        <p className="mt-1 text-sm">
          {error instanceof Error
            ? error.message
            : "Pastikan backend API berjalan di port 8080"}
        </p>
      </div>
    );
  }

  // Merge sales & purchase trends by month for Reports AreaChart
  const monthMap = new Map<string, { month: string; sales: number; purchase: number }>();
  for (const s of data.sales_trend) {
    monthMap.set(s.month, {
      month: s.month,
      sales: Math.round(s.total / 1_000_000_000), // in Miliar Rp
      purchase: 0,
    });
  }
  for (const p of data.purchase_trend) {
    const existing = monthMap.get(p.month) || {
      month: p.month,
      sales: 0,
      purchase: 0,
    };
    existing.purchase = Math.round(p.total / 1_000_000_000);
    monthMap.set(p.month, existing);
  }
  const trendData = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // Analytics Donut Data (Pending workflow distribution)
  const analyticsData = [
    {
      name: "PP Pending",
      value: Math.max(data.pending.purchase_requests, 1),
      color: "#3a36db",
    },
    {
      name: "PO Pending",
      value: Math.max(data.pending.purchase_orders, 1),
      color: "#2ee5a7",
    },
    {
      name: "SO Aktif",
      value: Math.max(data.pending.sales_orders, 1),
      color: "#ff69b4",
    },
  ];
  const totalPendingDocs =
    data.pending.purchase_requests +
    data.pending.purchase_orders +
    data.pending.sales_orders;

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
          <p className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
            Ringkasan operasional, tren penjualan &amp; pembelian, serta dokumen persetujuan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/purchasing/orders/new"
            className="inline-flex items-center gap-1 rounded-lg bg-[#3a36db] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-[#3a36db]/20 hover:bg-[#2f2bc2] transition-colors"
          >
            + Buat PO Baru
          </Link>
          <Link
            href="/sales/orders/new"
            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-[#06152b] shadow-xs hover:bg-slate-50 dark:bg-[#39394b] dark:text-white dark:hover:bg-white/10 transition-colors"
          >
            + Buat SO Baru
          </Link>
        </div>
      </div>

      {/* Top 4 Analytics Cards (Compact Desktop Layout) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-xs dark:bg-[#39394b]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#605cff]/12 text-[#605cff]">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-sm font-bold leading-snug tabular-nums"
              title={formatIDR(data.this_month.invoices_value)}
            >
              {formatIDR(data.this_month.invoices_value)}
            </div>
            <div className="text-[11px] font-medium text-[#788a9a] dark:text-[#a1a0b8]">
              Penjualan Bulan Ini ({data.this_month.sales_orders_count} SO)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-xs dark:bg-[#39394b]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2ee5a7]/15 text-emerald-600">
            <ShoppingBag size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-sm font-bold leading-snug tabular-nums"
              title={formatIDR(data.this_month.purchase_orders_value)}
            >
              {formatIDR(data.this_month.purchase_orders_value)}
            </div>
            <div className="text-[11px] font-medium text-[#788a9a] dark:text-[#a1a0b8]">
              Pembelian (PO) Bulan Ini
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-xs dark:bg-[#39394b]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ff69b4]/15 text-[#ff69b4]">
            <Wallet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-sm font-bold leading-snug tabular-nums"
              title={formatIDR(data.outstanding.ar)}
            >
              {formatIDR(data.outstanding.ar)}
            </div>
            <div className="text-[11px] font-medium text-[#788a9a] dark:text-[#a1a0b8]">
              Piutang Usaha (AR)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-xs dark:bg-[#39394b]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3a36db]/12 text-[#3a36db] dark:text-[#8b88ff]">
            <CreditCard size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-sm font-bold leading-snug tabular-nums"
              title={formatIDR(data.outstanding.ap)}
            >
              {formatIDR(data.outstanding.ap)}
            </div>
            <div className="text-[11px] font-medium text-[#788a9a] dark:text-[#a1a0b8]">
              Hutang Usaha (AP)
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Reports (7 cols) + Analytics Donut (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Reports Chart */}
        <div className="rounded-xl bg-white p-4 shadow-xs dark:bg-[#39394b] lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Reports (Tren 12 Bulan)</h2>
              <p className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                Perbandingan Nilai Penjualan vs Purchase Order (dalam Miliar Rp)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#605cff]" />
                Penjualan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff69b4]" />
                Pembelian
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#605cff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#605cff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="poGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff69b4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff69b4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#788a9a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#788a9a" }}
                  axisLine={false}
                  tickLine={false}
                  unit="M"
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    `Rp ${value} Miliar`,
                    name === "sales" ? "Penjualan" : "Pembelian (PO)",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    backgroundColor: "#ffffff",
                    color: "#06152b",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#605cff"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#salesGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="purchase"
                  stroke="#ff69b4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#poGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analytics Donut Chart */}
        <div className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-xs dark:bg-[#39394b] lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Analytics</h2>
              <p className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                Antrean Dokumen Menunggu Proses
              </p>
            </div>
            <Link
              href="/purchasing/orders?status=checked"
              className="text-[11px] font-semibold text-[#3a36db] dark:text-[#8b88ff] hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="relative h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {analyticsData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-lg font-bold">{totalPendingDocs}</div>
              <div className="text-[10px] font-medium text-[#788a9a] dark:text-[#a1a0b8]">
                Dokumen Aktif
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[11px]">
            <Link
              href="/purchasing/requests?status=pending"
              className="rounded-lg bg-[#f1f4fa] p-2 hover:bg-slate-200/70 dark:bg-[#222131] dark:hover:bg-white/10"
            >
              <div className="flex items-center justify-center gap-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#3a36db]" />
                PP
              </div>
              <div className="mt-0.5 text-sm font-bold">
                {data.pending.purchase_requests}
              </div>
            </Link>
            <Link
              href="/purchasing/orders?status=checked"
              className="rounded-lg bg-[#f1f4fa] p-2 hover:bg-slate-200/70 dark:bg-[#222131] dark:hover:bg-white/10"
            >
              <div className="flex items-center justify-center gap-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#2ee5a7]" />
                PO
              </div>
              <div className="mt-0.5 text-sm font-bold">
                {data.pending.purchase_orders}
              </div>
            </Link>
            <Link
              href="/sales/orders?status=S"
              className="rounded-lg bg-[#f1f4fa] p-2 hover:bg-slate-200/70 dark:bg-[#222131] dark:hover:bg-white/10"
            >
              <div className="flex items-center justify-center gap-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-[#ff69b4]" />
                SO
              </div>
              <div className="mt-0.5 text-sm font-bold">
                {data.pending.sales_orders}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Orders (7 cols) + Top Selling Products (5 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Recent Orders Table */}
        <div className="rounded-xl bg-white p-4 shadow-xs dark:bg-[#39394b] lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Recent Orders (Sales Order)</h2>
            <Link
              href="/sales/orders"
              className="text-[11px] font-semibold text-[#3a36db] dark:text-[#8b88ff] hover:underline"
            >
              Semua Order →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-[11px] font-semibold text-[#788a9a]">
                  <th className="pb-2">Nomor SO</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Tanggal</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 dark:divide-white/10">
                {(recentSo?.data || []).map((so) => (
                  <tr key={so.nomor} className="hover:bg-[#f1f4fa]/60 dark:hover:bg-white/5">
                    <td className="py-2 font-mono text-[11px] font-bold text-[#3a36db] dark:text-[#8b88ff]">
                      <Link href={`/sales/orders/detail?id=${encodeURIComponent(so.nomor)}`}>
                        {so.nomor}
                      </Link>
                    </td>
                    <td className="py-2 font-medium truncate max-w-[160px]">
                      {so.customer || so.id_customer}
                    </td>
                    <td className="py-2 text-[11px] text-[#788a9a]">
                      {formatDateID(so.tanggal)}
                    </td>
                    <td className="py-2 text-right font-mono text-[11px] font-bold">
                      {formatIDR(so.grandtotal)}
                    </td>
                    <td className="py-2 text-right">
                      <StatusBadge status={so.status_label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="rounded-xl bg-white p-4 shadow-xs dark:bg-[#39394b] lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Top Selling Products</h2>
            <Link
              href="/inventory/stock"
              className="text-[11px] font-semibold text-[#3a36db] dark:text-[#8b88ff] hover:underline"
            >
              Cek Stok →
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.top_items.slice(0, 5).map((item, idx) => (
              <div
                key={item.id_barang}
                className="flex items-center justify-between rounded-lg bg-[#f1f4fa]/70 p-2.5 dark:bg-[#222131]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#3a36db] dark:bg-[#39394b] dark:text-[#8b88ff] shadow-xs">
                    {idx % 2 === 0 ? <Package size={15} /> : <Boxes size={15} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {item.nama_barang}
                    </div>
                    <div className="text-[10px] font-mono text-[#788a9a]">
                      {item.id_barang}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <div className="text-[11px] font-bold text-[#3a36db] dark:text-[#8b88ff]">
                    {formatNumber(item.qty)}
                  </div>
                  <div className="text-[10px] text-[#788a9a]">Unit Terjual</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="rounded-xl bg-white p-4 shadow-xs dark:bg-[#39394b]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Top Customers</h2>
          <Link
            href="/master/customers"
            className="text-[11px] font-semibold text-[#3a36db] dark:text-[#8b88ff] hover:underline"
          >
            Master Customer →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {data.top_customers.slice(0, 4).map((c, idx) => (
            <div
              key={c.id_customer}
              className="rounded-lg bg-[#f1f4fa] p-3 dark:bg-[#222131]"
            >
              <div className="flex items-center justify-between text-[10px] text-[#788a9a]">
                <span>#{idx + 1}</span>
                <span className="font-mono">{c.id_customer}</span>
              </div>
              <div className="mt-1 text-xs font-bold truncate">{c.customer}</div>
              <div className="mt-1 font-mono text-[11px] font-bold text-[#3a36db] dark:text-[#8b88ff]">
                {formatIDR(c.total)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
