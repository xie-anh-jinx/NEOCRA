"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, SalesOrderSummary } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function SalesOrdersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["sales-orders", page, q, status],
    queryFn: () =>
      apiFetch<PaginatedResponse<SalesOrderSummary>>(
        "/sales/orders",
        {},
        { page, per_page: 25, q, status: status || undefined }
      ),
  });

  return (
    <ErpTable
      title="Sales Order (SO)"
      subtitle="Daftar pesanan penjualan pelanggan per cabang dan gudang"
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
        router.push(`/sales/orders/detail?id=${encodeURIComponent(r.nomor)}`)
      }
      actions={
        <Link
          href="/sales/orders/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={15} /> Buat SO Baru
        </Link>
      }
      filters={
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <option value="">Semua Status</option>
          <option value="S">Submitted (S)</option>
          <option value="P">Processed (P)</option>
          <option value="D">Draft (D)</option>
          <option value="C">Cancelled (C)</option>
        </select>
      }
      columns={[
        {
          header: "Nomor SO",
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
          header: "Customer",
          accessor: (r) => (
            <div>
              <div className="font-medium text-slate-900">
                {r.customer || r.id_customer || "-"}
              </div>
              {r.referensi && (
                <div className="text-xs text-slate-400">
                  PO Cust: {r.referensi}
                </div>
              )}
            </div>
          ),
        },
        {
          header: "Salesman / Gudang",
          accessor: (r) => (
            <div className="text-xs">
              <div>{r.nama_salesman || r.id_salesman || "-"}</div>
              <div className="text-slate-400">{r.gudang || r.id_gudang || "-"}</div>
            </div>
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
          header: "Status",
          accessor: (r) => <StatusBadge status={r.status_label} />,
        },
      ]}
    />
  );
}
