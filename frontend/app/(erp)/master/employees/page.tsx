"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { EmployeeDto, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function MasterEmployeesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["master-employees", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<EmployeeDto>>("/master/employees", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  return (
    <ErpTable
      title="Data Pegawai"
      subtitle="Daftar karyawan, jabatan, departemen, dan penempatan cabang"
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
          header: "ID Pegawai",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.id_pegawai}
            </span>
          ),
        },
        {
          header: "Nama Lengkap",
          accessor: (r) => (
            <div>
              <div className="font-medium text-slate-900">{r.nama}</div>
              <div className="text-xs text-slate-400">NIP: {r.nip || "-"}</div>
            </div>
          ),
        },
        {
          header: "Jabatan",
          accessor: (r) => r.jabatan || "-",
        },
        {
          header: "Departemen",
          accessor: (r) => r.departemen || "-",
        },
        {
          header: "Kantor Cabang",
          accessor: (r) => r.kantor || r.id_kantor_new || "-",
        },
        {
          header: "Status",
          accessor: (r) => (
            <StatusBadge status={r.status ? "Aktif" : "Nonaktif"} />
          ),
        },
      ]}
    />
  );
}
