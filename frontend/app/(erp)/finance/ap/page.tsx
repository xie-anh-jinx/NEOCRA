"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { ApInvoiceRow, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";

export default function FinanceApPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["finance-ap", page, q, status],
    queryFn: () =>
      apiFetch<PaginatedResponse<ApInvoiceRow>>("/finance/ap", {}, {
        page,
        per_page: 25,
        q,
        status: status || undefined,
      }),
  });

  return (
    <ErpTable
      title="Hutang Usaha (Accounts Payable)"
      subtitle="Daftar faktur hutang pembelian ke supplier (acc_ap_faktur)"
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
          <option value="">Semua Hutang</option>
          <option value="open">Belum Lunas (Open)</option>
          <option value="paid">Sudah Lunas (Paid)</option>
        </select>
      }
      columns={[
        {
          header: "No. AP",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.ap_number}
            </span>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.ap_date),
        },
        {
          header: "Supplier",
          accessor: (r) => r.supplier || r.vendor_code || "-",
        },
        {
          header: "No. PO / Reff",
          accessor: (r) => (
            <span className="font-mono text-xs">
              {r.po_number || r.reff || "-"}
            </span>
          ),
        },
        {
          header: "Total Faktur",
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
          header: "Sisa Hutang",
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
