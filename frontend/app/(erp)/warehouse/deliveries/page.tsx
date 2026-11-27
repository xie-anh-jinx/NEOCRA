"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { DeliveryOrderSummary, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function WarehouseDeliveriesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse-deliveries", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<DeliveryOrderSummary>>(
        "/warehouse/deliveries",
        {},
        { page, per_page: 25, q }
      ),
  });

  return (
    <ErpTable
      title="Delivery Order (DO)"
      subtitle="Surat jalan pengiriman barang ke customer"
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
        router.push(`/warehouse/deliveries/detail?id=${encodeURIComponent(r.nomor)}`)
      }
      columns={[
        {
          header: "Nomor DO",
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
          accessor: (r) => r.customer || r.id_customer || "-",
        },
        {
          header: "Gudang",
          accessor: (r) => r.gudang || r.id_gudang || "-",
        },
        {
          header: "Packing List / Kendaraan",
          accessor: (r) => (
            <div className="text-xs">
              <div className="font-mono">{r.no_pl || "-"}</div>
              <div className="text-slate-400">
                {r.driver || ""} {r.lic_plate ? `(${r.lic_plate})` : ""}
              </div>
            </div>
          ),
        },
        {
          header: "Tgl Diterima",
          accessor: (r) => formatDateID(r.received_date),
        },
        {
          header: "Status",
          accessor: (r) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}
