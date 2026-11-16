"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, SupplierDto } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function MasterSuppliersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["master-suppliers", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<SupplierDto>>("/master/suppliers", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  return (
    <ErpTable
      title="Master Supplier"
      subtitle="Daftar vendor dan pemasok barang PT. Cahaya Resource Abadi"
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
      columns={[
        {
          header: "Kode",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.id}
            </span>
          ),
        },
        {
          header: "Nama Supplier",
          accessor: (r) => (
            <div>
              <div className="font-medium text-slate-900">{r.supplier}</div>
              <div className="text-xs text-slate-400">{r.alamat || "-"}</div>
            </div>
          ),
        },
        {
          header: "Kategori",
          accessor: (r) => r.nm_kategori_supplier || "-",
        },
        {
          header: "Telepon / Email",
          accessor: (r) => (
            <div className="text-xs">
              <div>{r.telepon || "-"}</div>
              <div className="text-slate-400">{r.email || ""}</div>
            </div>
          ),
        },
        {
          header: "TOP",
          accessor: (r) => `${r.top ?? 0} Hari`,
        },
        {
          header: "Status",
          accessor: (r) => (
            <StatusBadge status={r.isaktif ? "Aktif" : "Nonaktif"} />
          ),
        },
      ]}
    />
  );
}
