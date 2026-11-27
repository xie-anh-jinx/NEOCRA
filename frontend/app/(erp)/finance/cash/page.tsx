"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { CashTransactionRow, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR, stripHtmlToText } from "@/lib/utils";

export default function FinanceCashPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["finance-cash", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<CashTransactionRow>>("/finance/cash", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  return (
    <ErpTable
      title="Transaksi Kas & Bank"
      subtitle="Bukti kas masuk dan kas keluar operasional (acc_kas)"
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
          header: "Nomor Kas",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.nomor}
            </span>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.tanggal),
        },
        {
          header: "Jenis",
          accessor: (r) =>
            r.id_jenis_transaksi === "K" ? "Kas Keluar" : "Kas Masuk",
        },
        {
          header: "Kepada / Diterima Dari",
          accessor: (r) => r.kepada || "-",
        },
        {
          header: "Uraian",
          accessor: (r) => (
            <span className="line-clamp-1 max-w-md">{stripHtmlToText(r.uraian, true)}</span>
          ),
        },
        {
          header: "Total",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-bold">{formatIDR(r.total)}</span>
          ),
        },
        {
          header: "Status",
          accessor: (r) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}
