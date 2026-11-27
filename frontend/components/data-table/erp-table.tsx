"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export interface ColumnDef<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  className?: string;
}

interface ErpTableProps<T> {
  title: string;
  subtitle?: string;
  columns: ColumnDef<T>[];
  data: T[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  search?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  loading?: boolean;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function ErpTable<T>({
  title,
  subtitle,
  columns,
  data,
  total,
  page,
  perPage,
  onPageChange,
  search,
  onSearchChange,
  searchPlaceholder = "Cari nomor, nama, keterangan...",
  loading,
  actions,
  filters,
  onRowClick,
}: ErpTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-[#788a9a] mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="rounded-2xl bg-white shadow-xs dark:bg-[#39394b]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-white/10">
          {onSearchChange ? (
            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#788a9a]"
              />
              <input
                type="text"
                value={search || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-transparent bg-[#f1f4fa] py-2.5 pl-10 pr-3 text-sm text-[#06152b] placeholder:text-[#788a9a] focus:border-[#3a36db] focus:bg-white focus:outline-none dark:bg-[#222131] dark:text-white"
              />
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-wrap items-center gap-2">{filters}</div>
        </div>

        {/* Mobile Card View (< md) */}
        <div className="divide-y divide-slate-100 md:hidden dark:divide-white/10">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-[#f1f4fa] dark:bg-[#222131]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#f1f4fa] dark:bg-[#222131]" />
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#788a9a]">
              Tidak ada data yang ditemukan.
            </div>
          ) : (
            data.map((row, rIdx) => (
              <div
                key={rIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={
                  onRowClick
                    ? "p-4 space-y-1.5 active:bg-[#f1f4fa] dark:active:bg-white/5 cursor-pointer"
                    : "p-4 space-y-1.5"
                }
              >
                {columns.map((col, cIdx) => (
                  <div
                    key={cIdx}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="shrink-0 font-semibold text-[#788a9a] dark:text-[#a1a0b8]">
                      {col.header}
                    </span>
                    <div className="text-right min-w-0 break-words">
                      {col.accessor(row)}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-[#788a9a] dark:border-white/10">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`px-5 py-3.5 ${col.className || ""}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, cIdx) => (
                      <td key={cIdx} className="px-5 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-[#f1f4fa]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-5 py-12 text-center text-sm text-[#788a9a]"
                  >
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={
                      onRowClick
                        ? "cursor-pointer hover:bg-[#f1f4fa]/80 transition-colors dark:hover:bg-white/5"
                        : "hover:bg-[#f1f4fa]/50 dark:hover:bg-white/5"
                    }
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-5 py-3.5 ${col.className || ""}`}
                      >
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-[#788a9a] dark:border-white/10">
          <div>
            Menampilkan{" "}
            <span className="font-bold text-[#06152b] dark:text-white">
              {data.length}
            </span>{" "}
            dari{" "}
            <span className="font-bold text-[#06152b] dark:text-white">
              {total.toLocaleString("id-ID")}
            </span>{" "}
            data
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 rounded-xl bg-[#f1f4fa] px-3 py-1.5 font-semibold text-[#06152b] hover:bg-slate-200/70 disabled:opacity-40 dark:bg-[#222131] dark:text-white"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-2 font-semibold">
              Hal {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 rounded-xl bg-[#f1f4fa] px-3 py-1.5 font-semibold text-[#06152b] hover:bg-slate-200/70 disabled:opacity-40 dark:bg-[#222131] dark:text-white"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
