"use client";

import React, { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PurchaseRequestDetail } from "@/types";
import { formatDateID, formatIDR, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ no_pp: string }>;
}) {
  const { no_pp } = use(params);
  const decodedNo = decodeURIComponent(no_pp);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pp-detail", decodedNo],
    queryFn: () =>
      apiFetch<PurchaseRequestDetail>(
        `/purchasing/requests/${encodeURIComponent(decodedNo)}`
      ),
  });

  const approveMutation = useMutation({
    mutationFn: (payload: { level: string; approve: boolean }) =>
      apiFetch(`/purchasing/requests/${encodeURIComponent(decodedNo)}/approve`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Status persetujuan PP berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["pp-detail", decodedNo] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-slate-500">Memuat detail PP...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/purchasing/requests"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-mono text-slate-900">
                {data.no_pp}
              </h1>
              <StatusBadge status={data.status_label} />
            </div>
            <p className="text-xs text-slate-500">
              Tanggal: {formatDateID(data.tanggal)} · Pembuat:{" "}
              {data.nama_pembuat || data.dibuat || "-"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              approveMutation.mutate({ level: "whm", approve: true })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            <CheckCircle2 size={14} /> Verify WHM
          </button>
          <button
            onClick={() =>
              approveMutation.mutate({ level: "gm", approve: true })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 size={14} /> Approve (GM/Director)
          </button>
          <button
            onClick={() =>
              approveMutation.mutate({ level: "gm", approve: false })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <XCircle size={14} /> Reject
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4 text-xs text-slate-600">
          <strong>Keterangan:</strong> {data.keterangan || "-"}
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Kode Barang</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3">Keperluan</th>
              <th className="px-4 py-3 text-right">Qty Order</th>
              <th className="px-4 py-3 text-right">Harga Est</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
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
                <td className="px-4 py-3 text-xs text-slate-600">
                  {d.keperluan || d.keterangan || "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatNumber(d.jumlah_order)} {d.satuan || ""}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatIDR(d.harga)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  {formatIDR(d.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
