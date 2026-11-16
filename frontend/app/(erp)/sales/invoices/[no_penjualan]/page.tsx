"use client";

import React, { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { SalesInvoiceDetail } from "@/types";
import { formatDateID, formatIDR, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SalesInvoiceDetailPage({
  params,
}: {
  params: Promise<{ no_penjualan: string }>;
}) {
  const { no_penjualan } = use(params);
  const decoded = decodeURIComponent(no_penjualan);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-detail", decoded],
    queryFn: () =>
      apiFetch<SalesInvoiceDetail>(
        `/sales/invoices/${encodeURIComponent(decoded)}`
      ),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 text-sm text-slate-500">Memuat detail Invoice...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/sales/invoices"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-mono text-slate-900">
              {data.no_penjualan}
            </h1>
            <StatusBadge
              status={data.is_lunas === "L" ? "Lunas" : data.status || "Open"}
            />
          </div>
          <p className="text-xs text-slate-500">
            Tanggal: {formatDateID(data.tanggal)} · Customer:{" "}
            {data.customer || data.id_customer} · DO: {data.no_do || "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">DPP</div>
          <div className="mt-1 font-mono text-sm font-bold">
            {formatIDR(data.dpp)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">PPN</div>
          <div className="mt-1 font-mono text-sm font-bold">
            {formatIDR(data.total_ppn)}
          </div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="text-xs font-semibold text-indigo-700">
            Grand Total
          </div>
          <div className="mt-1 font-mono text-base font-bold text-indigo-950">
            {formatIDR(data.grandtotal)}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="text-xs font-semibold text-emerald-700">Terbayar</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-950">
            {formatIDR(data.total_bayar)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Kode Barang</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Harga</th>
              <th className="px-4 py-3 text-right">Diskon</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.details.map((d) => (
              <tr key={d.urut}>
                <td className="px-4 py-3 text-slate-500">{d.urut}</td>
                <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                  {d.id_barang}
                </td>
                <td className="px-4 py-3 font-medium">{d.nama_barang || "-"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatNumber(d.qty)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatIDR(d.harga)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatIDR(d.diskonrp)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {formatIDR(d.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
