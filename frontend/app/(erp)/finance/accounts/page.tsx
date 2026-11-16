"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { AccountNode } from "@/types";
import { StatusBadge } from "@/components/ui/status-badge";

function renderAccountRows(
  nodes: AccountNode[],
  depth = 0
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const n of nodes) {
    out.push(
      <tr key={n.id_account} className="hover:bg-slate-50/70">
        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-indigo-700">
          {n.id_account}
        </td>
        <td className="px-4 py-2.5">
          <div
            style={{ paddingLeft: `${depth * 20}px` }}
            className={depth === 0 ? "font-bold text-slate-900" : "text-slate-700"}
          >
            {n.account}
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-slate-500">
          Level {n.level ?? depth + 1}
        </td>
        <td className="px-4 py-2.5">
          <StatusBadge status={n.aktif ? "Aktif" : "Nonaktif"} />
        </td>
      </tr>
    );
    if (n.children && n.children.length > 0) {
      out.push(...renderAccountRows(n.children, depth + 1));
    }
  }
  return out;
}

export default function FinanceAccountsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => apiFetch<AccountNode[]>("/finance/accounts"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Chart of Accounts (Bagan Akun)
        </h1>
        <p className="text-sm text-slate-500">
          Hierarki akun buku besar akuntansi PT. Cahaya Resource Abadi
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3 w-36">Kode Akun</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3 w-28">Level</th>
              <th className="px-4 py-3 w-28">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Memuat bagan akun...
                </td>
              </tr>
            ) : (
              renderAccountRows(data || [])
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
