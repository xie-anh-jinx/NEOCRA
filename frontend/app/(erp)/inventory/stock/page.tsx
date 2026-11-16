"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, StockRow, WarehouseItem } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { formatIDR, formatNumber } from "@/lib/utils";

export default function InventoryStockPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [idGudang, setIdGudang] = useState("");

  const { data: warehouses } = useQuery({
    queryKey: ["company-warehouses"],
    queryFn: () => apiFetch<WarehouseItem[]>("/company/warehouses"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-stock", page, q, idGudang],
    queryFn: () =>
      apiFetch<PaginatedResponse<StockRow>>("/inventory/stock", {}, {
        page,
        per_page: 25,
        q,
        id_gudang: idGudang || undefined,
        only_available: true,
      }),
  });

  return (
    <ErpTable
      title="Stok Persediaan Gudang"
      subtitle="Saldo stok aktual berdasarkan buku besar stok (stok_barang)"
      data={data?.data || []}
      total={data?.meta.total || 0}
      page={page}
      perPage={25}
      onPageChange={setPage}
      search={q}
      onSearchChange={(val) => {
        setQ(val);
        setPage(1);
      }}
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
          <option value="">Semua Gudang (61 Gudang)</option>
          {(warehouses || []).map((w) => (
            <option key={w.id_gudang} value={w.id_gudang}>
              {w.id_gudang} — {w.gudang}
            </option>
          ))}
        </select>
      }
      columns={[
        {
          header: "Gudang",
          accessor: (r) => (
            <div>
              <div className="font-semibold text-slate-800">
                {r.gudang || r.id_gudang}
              </div>
              <div className="text-xs font-mono text-slate-400">
                Kode: {r.id_gudang}
              </div>
            </div>
          ),
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
          header: "Nama Barang",
          accessor: (r) => (
            <span className="font-medium text-slate-900">
              {r.nama_barang || "-"}
            </span>
          ),
        },
        {
          header: "Stok Tersedia",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-bold text-emerald-700">
              {formatNumber(r.qty)} {r.satuan || ""}
            </span>
          ),
        },
        {
          header: "Nilai Persediaan (HPP)",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono text-xs text-slate-600">
              {formatIDR(r.nilai)}
            </span>
          ),
        },
      ]}
    />
  );
}
