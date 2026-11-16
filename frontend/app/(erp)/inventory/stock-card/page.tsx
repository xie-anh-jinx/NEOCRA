"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, StockCardMovement, WarehouseItem } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { formatDateID, formatIDR, formatNumber } from "@/lib/utils";

export default function StockCardPage() {
  const [page, setPage] = useState(1);
  const [idBarang, setIdBarang] = useState("");
  const [idGudang, setIdGudang] = useState("");

  const { data: warehouses } = useQuery({
    queryKey: ["company-warehouses"],
    queryFn: () => apiFetch<WarehouseItem[]>("/company/warehouses"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-stock-card", page, idBarang, idGudang],
    queryFn: () =>
      apiFetch<PaginatedResponse<StockCardMovement>>("/inventory/stock-card", {}, {
        page,
        per_page: 25,
        id_barang: idBarang || undefined,
        id_gudang: idGudang || undefined,
      }),
  });

  return (
    <ErpTable
      title="Kartu Stok (Stock Ledger)"
      subtitle="Riwayat mutasi batch masuk & sisa stok per gudang"
      data={data?.data || []}
      total={data?.meta.total || 0}
      page={page}
      perPage={25}
      onPageChange={setPage}
      search={idBarang}
      onSearchChange={(val) => {
        setIdBarang(val);
        setPage(1);
      }}
      searchPlaceholder="Masukkan Kode Barang (mis. 550044580)..."
      loading={isLoading}
      filters={
        <select
          value={idGudang}
          onChange={(e) => {
            setIdGudang(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="">Semua Gudang</option>
          {(warehouses || []).map((w) => (
            <option key={w.id_gudang} value={w.id_gudang}>
              {w.id_gudang} — {w.gudang}
            </option>
          ))}
        </select>
      }
      columns={[
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.tanggal),
        },
        {
          header: "Gudang",
          accessor: (r) => <span className="font-mono">{r.id_gudang}</span>,
        },
        {
          header: "Kode Barang",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.id_barang}
            </span>
          ),
        },
        {
          header: "No. Referensi (BTB/IT)",
          accessor: (r) => (
            <span className="font-mono text-xs">{r.reff || "-"}</span>
          ),
        },
        {
          header: "Qty Masuk (Persediaan)",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono">{formatNumber(r.persediaan)}</span>
          ),
        },
        {
          header: "Sisa Batch (Stok)",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-bold text-emerald-700">
              {formatNumber(r.stok)}
            </span>
          ),
        },
        {
          header: "HPP Satuan",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono text-xs">{formatIDR(r.hpp)}</span>
          ),
        },
      ]}
    />
  );
}
