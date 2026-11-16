"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, SalesInvoiceSummary } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function SalesInvoicesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["sales-invoices", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<SalesInvoiceSummary>>(
        "/sales/invoices",
        {},
        { page, per_page: 25, q }
      ),
  });

  return (
    <ErpTable
      title="Invoice Penjualan"
      subtitle="Daftar faktur penjualan (penjualan) beserta status pelunasan"
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
      onRowClick={(r) =>
        router.push(`/sales/invoices/${encodeURIComponent(r.no_penjualan)}`)
      }
      columns={[
        {
          header: "No. Invoice",
          accessor: (r) => (
            <div>
              <div className="font-mono font-semibold text-indigo-700">
                {r.no_penjualan}
              </div>
              {r.faktur && (
                <div className="text-[11px] text-slate-400">
                  FP: {r.faktur}
                </div>
              )}
            </div>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.tanggal),
        },
        {
          header: "Customer",
          accessor: (r) => (
            <span className="font-medium text-slate-900">
              {r.customer || r.id_customer || "-"}
            </span>
          ),
        },
        {
          header: "No. DO",
          accessor: (r) => (
            <span className="font-mono text-xs">{r.no_do || "-"}</span>
          ),
        },
        {
          header: "Grand Total",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-bold text-slate-900">
              {formatIDR(r.grandtotal)}
            </span>
          ),
        },
        {
          header: "Jatuh Tempo",
          accessor: (r) => formatDateID(r.tgl_jatuh_tempo),
        },
        {
          header: "Status",
          accessor: (r) => (
            <StatusBadge
              status={r.is_lunas === "L" ? "Lunas" : r.status || "Open"}
            />
          ),
        },
      ]}
    />
  );
}
