"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { JournalDetail } from "@/types";
import { formatDateID, formatIDR, stripHtmlToText } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function JournalDetailPageContent() {
  const searchParams = useSearchParams();
  const decoded = searchParams.get("id") || "";
const { data, isLoading } = useQuery({
    queryKey: ["journal-detail", decoded],
    queryFn: () =>
      apiFetch<JournalDetail>(
        `/finance/journals/${encodeURIComponent(decoded)}`
      ),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 text-sm text-slate-500">Memuat detail Jurnal...</div>
    );
  }

  const totalDebit = data.lines
    .filter((l) => l.is_debit)
    .reduce((s, l) => s + l.value, 0);
  const totalCredit = data.lines
    .filter((l) => !l.is_debit)
    .reduce((s, l) => s + l.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/finance/journals"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-mono text-slate-900">
              {data.gl_number}
            </h1>
            <StatusBadge status={data.posting ? "Posted" : "Draft"} />
          </div>
          <p className="text-xs text-slate-500">
            Tanggal: {formatDateID(data.gl_date)} · Kode:{" "}
            {data.journal_code || "-"} · Referensi: {data.reference || "-"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs text-slate-600">
          <strong>Catatan:</strong>
          <div className="mt-1 whitespace-pre-line">{stripHtmlToText(data.note)}</div>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Kode Akun</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Kredit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.lines.map((l) => (
              <tr key={l.line}>
                <td className="px-4 py-3 text-slate-500">{l.line}</td>
                <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                  {l.id_account}
                </td>
                <td className="px-4 py-3 font-medium">{l.account || "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <span className="whitespace-pre-line">{stripHtmlToText(l.keterangan)}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700">
                  {l.is_debit ? formatIDR(l.value) : "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-indigo-700">
                  {!l.is_debit ? formatIDR(l.value) : "-"}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td colSpan={4} className="px-4 py-3 text-right">
                Total Balance
              </td>
              <td className="px-4 py-3 text-right font-mono text-emerald-800">
                {formatIDR(totalDebit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-indigo-800">
                {formatIDR(totalCredit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function JournalDetailPagePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat detail...</div>}>
      <JournalDetailPageContent />
    </Suspense>
  );
}
