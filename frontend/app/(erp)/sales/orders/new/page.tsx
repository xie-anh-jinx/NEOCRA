"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { SalesOrderDetail } from "@/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [tanggal, setTanggal] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [idCustomer, setIdCustomer] = useState("01000113");
  const [idGudang, setIdGudang] = useState("001");
  const [referensi, setReferensi] = useState("");
  const [isPpn, setIsPpn] = useState(true);
  const [lines, setLines] = useState([
    { id_barang: "550044580", qty: 5, harga: 48500, diskonpersen: 0, remark: "" },
  ]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<SalesOrderDetail>("/sales/orders", {
        method: "POST",
        body: JSON.stringify({
          tanggal,
          id_customer: idCustomer,
          id_gudang: idGudang,
          is_ppn: isPpn,
          top: 30,
          referensi,
          details: lines,
        }),
      }),
    onSuccess: (res) => {
      toast.success(`SO ${res.nomor} berhasil dibuat`);
      router.push(`/sales/orders/${encodeURIComponent(res.nomor)}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gross = lines.reduce((s, l) => s + l.qty * l.harga, 0);
  const disc = lines.reduce(
    (s, l) => s + l.qty * l.harga * ((l.diskonpersen || 0) / 100),
    0
  );
  const dpp = gross - disc;
  const ppn = isPpn ? dpp * 0.11 : 0;
  const grandTotal = dpp + ppn;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/sales/orders"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Buat Sales Order (SO) Baru
          </h1>
          <p className="text-xs text-slate-500">
            Format penomoran otomatis NNN/SO/CRA/ROMAWI/TAHUN
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Tanggal SO
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
              ID Customer (mis. 01000113)
            </label>
            <input
              type="text"
              value={idCustomer}
              onChange={(e) => setIdCustomer(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Gudang Pengirim (mis. 001)
            </label>
            <input
              type="text"
              value={idGudang}
              onChange={(e) => setIdGudang(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">
              No. PO Customer / Referensi
            </label>
            <input
              type="text"
              value={referensi}
              onChange={(e) => setReferensi(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isPpn}
                onChange={(e) => setIsPpn(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Kenakan PPN 11%
            </label>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Item Barang SO</h3>
            <button
              type="button"
              onClick={() =>
                setLines([
                  ...lines,
                  { id_barang: "", qty: 1, harga: 0, diskonpersen: 0, remark: "" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
            >
              <Plus size={14} /> Tambah Item
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center rounded-lg bg-slate-50 p-2.5"
              >
                <div className="col-span-4">
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
                <div className="col-span-2">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].qty = Number(e.target.value);
                      setLines(next);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-right"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    placeholder="Harga Jual"
                    value={line.harga}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].harga = Number(e.target.value);
                      setLines(next);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-right"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    placeholder="Diskon %"
                    value={line.diskonpersen}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i].diskonpersen = Number(e.target.value);
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

          <div className="mt-4 flex flex-col items-end space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-600">
            <div>DPP: <span className="font-mono font-semibold">{formatIDR(dpp)}</span></div>
            <div>PPN (11%): <span className="font-mono font-semibold">{formatIDR(ppn)}</span></div>
            <div className="text-sm font-bold text-slate-900">
              Grand Total: <span className="font-mono text-indigo-700">{formatIDR(grandTotal)}</span>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="mt-3 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan Sales Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
