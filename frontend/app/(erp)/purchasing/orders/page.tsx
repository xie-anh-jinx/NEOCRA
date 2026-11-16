"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, PurchaseOrderSummary } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function PurchaseOrdersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["purchasing-orders", page, q, status],
    queryFn: () =>
      apiFetch<PaginatedResponse<PurchaseOrderSummary>>(
        "/purchasing/orders",
        {},
        { page, per_page: 25, q, status: status || undefined }
      ),
  });

  return (
    <ErpTable
      title="Purchase Order (PO)"
      subtitle="Pesanan pembelian ke supplier beserta alur Check & Approval Direktur"
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
      onRowClick={(r) => router.push(`/purchasing/orders/${r.id}`)}
      actions={
        <Link
          href="/purchasing/orders/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={15} /> Buat PO Baru
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
          <option value="draft">Draft</option>
          <option value="checked">Checked (Menunggu Approval)</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      }
      columns={[
        {
          header: "Nomor PO",
          accessor: (r) => (
            <div>
              <div className="font-mono font-semibold text-indigo-700">
                {r.nomor_po}
              </div>
              {r.no_intruksi_po && (
                <div className="text-[11px] text-slate-400">
                  IP: {r.no_intruksi_po}
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
          header: "Supplier",
          accessor: (r) => (
            <div className="font-medium text-slate-900">
              {r.nama_supplier || r.id_supplier}
            </div>
          ),
        },
        {
          header: "Gudang Tujuan",
          accessor: (r) => r.gudang || r.id_gudang || "-",
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
