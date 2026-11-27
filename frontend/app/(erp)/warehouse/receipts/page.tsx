"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { GoodsReceiptSummary, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function WarehouseReceiptsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse-receipts", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<GoodsReceiptSummary>>(
        "/warehouse/receipts",
        {},
        { page, per_page: 25, q }
      ),
  });

  return (
    <ErpTable
      title="Penerimaan Barang (BTB / GRN)"
      subtitle="Daftar bukti terima barang dari supplier ke gudang"
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
        router.push(`/warehouse/receipts/detail?id=${encodeURIComponent(r.no_penerimaan)}`)
      }
      columns={[
        {
          header: "No. Penerimaan",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.no_penerimaan}
            </span>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.tgl_penerimaan),
        },
        {
          header: "Supplier",
          accessor: (r) => r.supplier || r.id_supplier || "-",
        },
        {
          header: "Gudang",
          accessor: (r) => r.gudang || r.id_gudang || "-",
        },
        {
          header: "Nomor PO",
          accessor: (r) => (
            <span className="font-mono text-xs">{r.nomor_po || "-"}</span>
          ),
        },
        {
          header: "Total Nilai",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-semibold">
              {formatIDR(r.grandtotal)}
            </span>
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
