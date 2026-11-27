"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PurchaseRequestDetail } from "@/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [tanggal, setTanggal] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [keterangan, setKeterangan] = useState("");
  const [lines, setLines] = useState([
    {
      id_barang: "550044580",
      keperluan: "Stok Reguler Cabang",
      jumlah_order: 10,
      satuan: "DRM",
      harga: 4500000,
    },
  ]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<PurchaseRequestDetail>("/purchasing/requests", {
        method: "POST",
        body: JSON.stringify({
          tanggal,
          jenis: "D",
          keterangan,
          details: lines,
        }),
      }),
    onSuccess: (res) => {
      toast.success(`PP ${res.no_pp} berhasil dibuat`);
      router.push(`/purchasing/requests/detail?id=${encodeURIComponent(res.no_pp)}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = lines.reduce(
    (acc, l) => acc + l.jumlah_order * (l.harga || 0),
    0
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/purchasing/requests"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Buat Permintaan Pembelian (PP)
            </h1>
            <p className="text-xs text-slate-500">
              Nomor dokumen otomatis mengikuti format NNN/CRA/PP/ROMAWI/TAHUN
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Tanggal Pengajuan
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Keterangan / Keperluan Umum
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Mis. Pengadaan pelumas Q3"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Rincian Barang yang Diminta
            </h3>
            <button
              type="button"
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    id_barang: "",
                    keperluan: "",
                    jumlah_order: 1,
                    satuan: "LTR",
                    harga: 0,
                  },
                ])
              }
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
            >
              <Plus size={14} /> Tambah Baris
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center rounded-lg bg-slate-50 p-2.5"
              >
                <div className="col-span-3">
                  <input
                    placeholder="Kode Barang"
                    value={line.id_barang}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].id_barang = e.target.value;
                      setLines(next);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    placeholder="Keperluan / Spesifikasi"
                    value={line.keperluan}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].keperluan = e.target.value;
                      setLines(next);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={line.jumlah_order}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].jumlah_order = Number(e.target.value);
                      setLines(next);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-right"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    placeholder="Harga Est"
                    value={line.harga}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].harga = Number(e.target.value);
                      setLines(next);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-right"
                  />
                </div>
                <div className="col-span-1 text-right">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines(lines.filter((_, idx) => idx !== i))
                      }
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-slate-700">
              Total Estimasi: <span className="text-indigo-700">{formatIDR(total)}</span>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan Permintaan Pembelian"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
