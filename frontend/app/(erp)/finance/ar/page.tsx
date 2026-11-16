"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { ArInvoiceRow, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";

export default function FinanceArPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["finance-ar", page, q, status],
    queryFn: () =>
      apiFetch<PaginatedResponse<ArInvoiceRow>>("/finance/ar", {}, {
        page,
        per_page: 25,
        q,
        status: status || undefined,
      }),
  });

  return (
    <ErpTable
      title="Piutang Usaha (Accounts Receivable)"
      subtitle="Daftar faktur piutang pelanggan (acc_ar_faktur) dan sisa tagihan"
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
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="">Semua Piutang</option>
          <option value="open">Belum Lunas (Open)</option>
          <option value="paid">Sudah Lunas (Paid)</option>
        </select>
      }
      columns={[
        {
          header: "No. AR",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.ar_number}
            </span>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.ar_date),
        },
        {
          header: "Customer",
          accessor: (r) => r.customer || r.customer_code || "-",
        },
        {
          header: "No. Invoice",
          accessor: (r) => (
            <span className="font-mono text-xs">{r.no_invoice || "-"}</span>
          ),
        },
        {
          header: "Total Tagihan",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono">{formatIDR(r.total)}</span>
          ),
        },
        {
          header: "Terbayar",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono text-emerald-700">
              {formatIDR(r.bayar)}
            </span>
          ),
        },
        {
          header: "Sisa Piutang",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-bold text-rose-700">
              {formatIDR(r.outstanding)}
            </span>
          ),
        },
        {
          header: "Jatuh Tempo",
          accessor: (r) => formatDateID(r.due_date),
        },
        {
          header: "Status",
          accessor: (r) => (
            <StatusBadge status={r.outstanding <= 0 ? "Paid" : "Open"} />
          ),
        },
      ]}
    />
  );
}
