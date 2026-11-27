"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Layers, ArrowLeft } from "lucide-react";

function ModulePlaceholderContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "Modul CRA";
  const outcome = searchParams.get("outcome") || "-";
  const role = searchParams.get("role");

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xs dark:bg-[#39394b]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#3a36db]/10 text-[#3a36db] dark:bg-[#605cff]/20 dark:text-[#8b88ff]">
        <Layers size={24} />
      </div>
      <h1 className="text-2xl font-bold text-[#06152b] dark:text-white">{name}</h1>
      <p className="mt-2 text-sm text-[#788a9a] dark:text-[#a1a0b8]">
        Menu ini terdaftar pada database hak akses CRA (<code className="font-mono text-xs text-[#06152b] dark:text-white">{outcome}</code>)
        {role ? (
          <>
            {" "}dengan role <code className="font-mono text-xs text-[#3a36db] dark:text-[#8b88ff]">{role}</code>
          </>
        ) : null}
        .
      </p>
      <div className="mt-6 rounded-xl bg-[#f1f4fa] p-4 text-xs text-[#788a9a] dark:bg-[#222131] dark:text-[#a1a0b8]">
        Tampilan khusus untuk sub-modul ini sedang dalam tahap migrasi ke antarmuka NEOCRA. Data operasional dan hak aksesnya sudah tersinkronisasi dari database CRA.
      </div>
      <div className="mt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-[#3a36db] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#2f2bc2] transition-colors"
        >
          <ArrowLeft size={14} />
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function ModulePlaceholderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Memuat modul...</div>}>
      <ModulePlaceholderContent />
    </Suspense>
  );
}
