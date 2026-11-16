"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse, PurchaseRequestSummary } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function PurchaseRequestsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["purchasing-requests", page, q, status],
    queryFn: () =>
      apiFetch<PaginatedResponse<PurchaseRequestSummary>>(
        "/purchasing/requests",
        {},
        { page, per_page: 25, q, status: status || undefined }
      ),
  });

  return (
    <ErpTable
      title="Permintaan Pembelian (PP)"
      subtitle="Daftar pengajuan pembelian barang dan status persetujuan berjenjang (SPV / WHM / GM)"
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
        router.push(`/purchasing/requests/${encodeURIComponent(r.no_pp)}`)
      }
      actions={
        <Link
          href="/purchasing/requests/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={15} /> Buat PP Baru
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
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      }
      columns={[
        {
          header: "Nomor PP",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.no_pp}
            </span>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.tanggal),
        },
        {
          header: "Pembuat",
          accessor: (r) => r.nama_pembuat || r.dibuat || "-",
        },
        {
          header: "Keterangan",
          accessor: (r) => (
            <span className="line-clamp-1 max-w-xs">{r.keterangan || "-"}</span>
          ),
        },
        {
          header: "Estimasi Nilai",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-semibold">{formatIDR(r.total)}</span>
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
