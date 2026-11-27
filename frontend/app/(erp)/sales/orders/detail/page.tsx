"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { SalesOrderDetail } from "@/types";
import { formatDateID, formatIDR, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

function SalesOrderDetailPageContent() {
  const searchParams = useSearchParams();
  const decodedNomor = searchParams.get("id") || "";
const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["so-detail", decodedNomor],
    queryFn: () =>
      apiFetch<SalesOrderDetail>(
        `/sales/orders/${encodeURIComponent(decodedNomor)}`
      ),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/sales/orders/${encodeURIComponent(decodedNomor)}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Status Sales Order diperbarui");
      queryClient.invalidateQueries({ queryKey: ["so-detail", decodedNomor] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-slate-500">Memuat detail SO...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/orders"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-mono text-slate-900">
                {data.nomor}
              </h1>
              <StatusBadge status={data.status_label} />
            </div>
            <p className="text-xs text-slate-500">
              Tanggal: {formatDateID(data.tanggal)} · Customer:{" "}
              {data.customer || data.id_customer} · Gudang:{" "}
              {data.gudang || data.id_gudang}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => statusMutation.mutate("P")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 size={14} /> Mark Processed (P)
          </button>
          <button
            onClick={() => statusMutation.mutate("C")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <XCircle size={14} /> Cancel SO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-400">Subtotal</div>
          <div className="mt-1 font-mono text-sm font-bold">
            {formatIDR(data.total)}
          </div>
        </div>
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
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Kode Barang</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3 text-right">Qty SO</th>
              <th className="px-4 py-3 text-right">Terkirim</th>
              <th className="px-4 py-3 text-right">Sisa</th>
              <th className="px-4 py-3 text-right">Harga</th>
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
                <td className="px-4 py-3 text-right font-mono text-emerald-700">
                  {formatNumber(d.diambil)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">
                  {formatNumber(d.sisa)}
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

export default function SalesOrderDetailPagePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat detail...</div>}>
      <SalesOrderDetailPageContent />
    </Suspense>
  );
}
