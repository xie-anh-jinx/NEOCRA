"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { DashboardResponse } from "@/types";
import { formatIDR, formatNumber } from "@/lib/utils";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ClipboardList,
  CreditCard,
  FileText,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reporting-dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/reporting/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-white border border-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle size={18} />
          <span>Gagal memuat data dashboard</span>
        </div>
        <p className="mt-1 text-sm">
          {error instanceof Error ? error.message : "Pastikan backend API berjalan di port 8080"}
        </p>
      </div>
    );
  }

  const maxSales = Math.max(...data.sales_trend.map((d) => d.total), 1);
  const maxPo = Math.max(...data.purchase_trend.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Eksekutif
          </h1>
          <p className="text-sm text-slate-500">
            Ringkasan transaksi bisnis utama, persetujuan dokumen, dan arus kas PT. Cahaya Resource Abadi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/purchasing/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            + Buat Purchase Order
          </Link>
          <Link
            href="/sales/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Buat Sales Order
          </Link>
        </div>
      </div>

      {/* Pending Approvals Alert Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/purchasing/requests?status=pending"
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-4 hover:bg-amber-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="text-xs font-medium text-amber-800">
                Permintaan Pembelian (PP) Pending
              </div>
              <div className="text-xl font-bold text-amber-950">
                {formatNumber(data.pending.purchase_requests)} Dokumen
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} className="text-amber-700" />
        </Link>

        <Link
          href="/purchasing/orders?status=checked"
          className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 hover:bg-indigo-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <ShoppingCart size={20} />
            </div>
            <div>
              <div className="text-xs font-medium text-indigo-800">
                Purchase Order Menunggu Approval
              </div>
              <div className="text-xl font-bold text-indigo-950">
                {formatNumber(data.pending.purchase_orders)} PO
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} className="text-indigo-700" />
        </Link>

        <Link
          href="/sales/orders?status=S"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 hover:bg-emerald-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <FileText size={20} />
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-800">
                Sales Order Aktif (Submitted)
              </div>
              <div className="text-xl font-bold text-emerald-950">
                {formatNumber(data.pending.sales_orders)} SO
              </div>
            </div>
          </div>
          <ArrowUpRight size={18} className="text-emerald-700" />
        </Link>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Penjualan Bulan Berjalan</span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatIDR(data.this_month.invoices_value)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            SO: {data.this_month.sales_orders_count} order ({formatIDR(data.this_month.sales_orders_value)})
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Pembelian (PO) Bulan Ini</span>
            <ShoppingCart size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {formatIDR(data.this_month.purchase_orders_value)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total nilai PO diterbitkan
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Total Piutang Usaha (AR)</span>
            <Wallet size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-blue-700">
            {formatIDR(data.outstanding.ar)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Saldo faktur belum terbayar
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Total Hutang Usaha (AP)</span>
            <CreditCard size={16} className="text-rose-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-rose-700">
            {formatIDR(data.outstanding.ap)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Kewajiban kepada supplier
          </div>
        </div>
      </div>

      {/* 12-Month Trend Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800">
            Tren Penjualan (12 Bulan Terakhir)
          </h2>
          <div className="mt-4 space-y-2.5">
            {data.sales_trend.map((pt) => {
              const pct = Math.max(4, Math.round((pt.total / maxSales) * 100));
              return (
                <div key={pt.month} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-mono font-medium text-slate-600">
                    {pt.month}
                  </span>
                  <div className="flex-1 rounded-full bg-slate-100 h-3 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-36 text-right font-mono font-semibold text-slate-700">
                    {formatIDR(pt.total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800">
            Tren Purchase Order (12 Bulan Terakhir)
          </h2>
          <div className="mt-4 space-y-2.5">
            {data.purchase_trend.map((pt) => {
              const pct = Math.max(4, Math.round((pt.total / maxPo) * 100));
              return (
                <div key={pt.month} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-mono font-medium text-slate-600">
                    {pt.month}
                  </span>
                  <div className="flex-1 rounded-full bg-slate-100 h-3 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-36 text-right font-mono font-semibold text-slate-700">
                    {formatIDR(pt.total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Customers & Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800">
            Top Customer (Berdasarkan Nilai Invoice)
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {data.top_customers.map((c, idx) => (
              <div
                key={c.id_customer}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <div className="font-medium text-slate-800 truncate">
                      {c.customer}
                    </div>
                    <div className="text-xs text-slate-400">{c.id_customer}</div>
                  </div>
                </div>
                <div className="font-mono text-xs font-semibold text-slate-800">
                  {formatIDR(c.total)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800">
            Produk Terlaris (Berdasarkan Kuantitas)
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {data.top_items.map((item, idx) => (
              <div
                key={item.id_barang}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <div className="font-medium text-slate-800 truncate">
                      {item.nama_barang}
                    </div>
                    <div className="text-xs text-slate-400">
                      Kode: {item.id_barang}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-xs font-semibold text-indigo-700">
                  {formatNumber(item.qty)} Unit
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
