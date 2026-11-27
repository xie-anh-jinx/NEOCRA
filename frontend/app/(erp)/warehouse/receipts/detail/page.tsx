"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { GoodsReceiptDetail } from "@/types";
import { formatDateID, formatIDR, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function GoodsReceiptDetailPageContent() {
  const searchParams = useSearchParams();
  const decoded = searchParams.get("id") || "";
const { data, isLoading } = useQuery({
    queryKey: ["receipt-detail", decoded],
    queryFn: () =>
      apiFetch<GoodsReceiptDetail>(
        `/warehouse/receipts/${encodeURIComponent(decoded)}`
      ),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Memuat detail Penerimaan Barang...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/warehouse/receipts"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-mono text-slate-900">
              {data.no_penerimaan}
            </h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-xs text-slate-500">
            Tanggal: {formatDateID(data.tgl_penerimaan)} · Supplier:{" "}
            {data.supplier || data.id_supplier} · Gudang:{" "}
            {data.gudang || data.id_gudang} · PO: {data.nomor_po || "-"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Kode Barang</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3 text-right">Qty Diterima</th>
              <th className="px-4 py-3 text-right">Harga Satuan</th>
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

export default function GoodsReceiptDetailPagePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat detail...</div>}>
      <GoodsReceiptDetailPageContent />
    </Suspense>
  );
}
