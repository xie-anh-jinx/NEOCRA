"use client";

import React, { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { DeliveryOrderDetail } from "@/types";
import { formatDateID, formatNumber } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DeliveryOrderDetailPage({
  params,
}: {
  params: Promise<{ nomor: string }>;
}) {
  const { nomor } = use(params);
  const decoded = decodeURIComponent(nomor);

  const { data, isLoading } = useQuery({
    queryKey: ["do-detail", decoded],
    queryFn: () =>
      apiFetch<DeliveryOrderDetail>(
        `/warehouse/deliveries/${encodeURIComponent(decoded)}`
      ),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Memuat detail Delivery Order...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/warehouse/deliveries"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-mono text-slate-900">
              {data.nomor}
            </h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-xs text-slate-500">
            Tanggal: {formatDateID(data.tanggal)} · Customer:{" "}
            {data.customer || data.id_customer} · Gudang:{" "}
            {data.gudang || data.id_gudang} · Driver: {data.driver || "-"} (
            {data.lic_plate || "-"})
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
              <th className="px-4 py-3 text-right">Qty Kirim</th>
              <th className="px-4 py-3 text-right">Qty Diterima</th>
              <th className="px-4 py-3">Kemasan / Keterangan</th>
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
                  {formatNumber(d.qty_diterima)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {d.kemasan || d.keterangan || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
