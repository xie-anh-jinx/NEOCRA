"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { CustomerDto, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatIDR } from "@/lib/utils";

export default function MasterCustomersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["master-customers", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<CustomerDto>>("/master/customers", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  return (
    <ErpTable
      title="Master Customer"
      subtitle="Daftar pelanggan dan mitra bisnis"
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
          header: "ID Kontak",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.id_kontak}
            </span>
          ),
        },
        {
          header: "Nama Customer",
          accessor: (r) => (
            <div>
              <div className="font-medium text-slate-900">{r.customer}</div>
              <div className="text-xs text-slate-400">
                {r.alamat_penagihan || "-"}
              </div>
            </div>
          ),
        },
        {
          header: "NPWP",
          accessor: (r) => <span className="font-mono text-xs">{r.no_npwp || "-"}</span>,
        },
        {
          header: "Salesman",
          accessor: (r) => r.nama_sales || r.id_sales || "-",
        },
        {
          header: "Batas Kredit / TOP",
          accessor: (r) => (
            <div className="text-xs">
              <div className="font-semibold">{formatIDR(r.batas_kredit)}</div>
              <div className="text-slate-400">{r.top ?? 0} Hari</div>
            </div>
          ),
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
