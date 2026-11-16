import React from "react";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status || "Draft").toLowerCase();
  let color = "bg-slate-100 text-slate-700 border-slate-200";
  if (
    s.includes("approve") ||
    s === "lunas" ||
    s === "paid" ||
    s === "active" ||
    s === "aktif" ||
    s === "posted" ||
    s === "processed" ||
    s === "p"
  ) {
    color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (
    s.includes("check") ||
    s.includes("submit") ||
    s === "s" ||
    s === "open"
  ) {
    color = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (s.includes("pending") || s.includes("draft") || s === "d") {
    color = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (
    s.includes("reject") ||
    s.includes("cancel") ||
    s === "c" ||
    s === "r"
  ) {
    color = "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        color
      )}
    >
      {status || "Draft"}
    </span>
  );
}
