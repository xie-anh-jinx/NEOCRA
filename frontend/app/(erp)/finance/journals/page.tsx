"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { JournalSummary, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateID, formatIDR, stripHtmlToText } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function FinanceJournalsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["finance-journals", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<JournalSummary>>("/finance/journals", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  return (
    <ErpTable
      title="Jurnal Umum (General Ledger)"
      subtitle="Daftar transaksi jurnal akuntansi (acc_gl_trans)"
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
        router.push(`/finance/journals/detail?id=${encodeURIComponent(r.gl_number)}`)
      }
      columns={[
        {
          header: "No. Jurnal (GL)",
          accessor: (r) => (
            <span className="font-mono font-semibold text-indigo-700">
              {r.gl_number}
            </span>
          ),
        },
        {
          header: "Tanggal",
          accessor: (r) => formatDateID(r.gl_date),
        },
        {
          header: "Kode Jurnal",
          accessor: (r) => (
            <span className="font-mono text-xs">{r.journal_code || "-"}</span>
          ),
        },
        {
          header: "Referensi",
          accessor: (r) => (
            <span className="font-mono text-xs">{r.reference || "-"}</span>
          ),
        },
        {
          header: "Uraian / Catatan",
          accessor: (r) => (
            <span className="line-clamp-1 max-w-md">{stripHtmlToText(r.note, true)}</span>
          ),
        },
        {
          header: "Nilai Jurnal",
          className: "text-right",
          accessor: (r) => (
            <span className="font-mono font-semibold">
              {formatIDR(r.jumlah)}
            </span>
          ),
        },
        {
          header: "Posting",
          accessor: (r) => (
            <StatusBadge status={r.posting ? "Posted" : "Draft"} />
          ),
        },
      ]}
    />
  );
}
