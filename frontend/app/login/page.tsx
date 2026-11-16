"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Lock, ShieldCheck, User, BarChart3, Layers, Zap } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("superadmin123");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      toast.success("Berhasil masuk ke NEOCRA ERP");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f1f4fa] text-[#06152b]">
      {/* Left White Panel (Figma Login 448px style) */}
      <div className="flex w-full flex-col justify-center bg-white px-8 py-12 shadow-xl lg:w-[460px] lg:shrink-0 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#605cff] to-[#3a36db] text-xl font-bold text-white shadow-lg shadow-[#3a36db]/30">
              CRA
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#06152b]">
              Masuk ke NEOCRA
            </h1>
            <p className="mt-1 text-xs font-medium text-[#788a9a]">
              Corporate Resource Application — PT. Cahaya Resource Abadi
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#06152b]">
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#788a9a]"
                />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full rounded-xl border border-transparent bg-[#f1f4fa] py-3 pl-10 pr-4 text-sm text-[#06152b] placeholder:text-[#788a9a] focus:border-[#3a36db] focus:bg-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#06152b]">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#788a9a]"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-xl border border-transparent bg-[#f1f4fa] py-3 pl-10 pr-4 text-sm text-[#06152b] placeholder:text-[#788a9a] focus:border-[#3a36db] focus:bg-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#3a36db] py-3 text-sm font-semibold text-white shadow-lg shadow-[#3a36db]/25 hover:bg-[#2f2bc2] disabled:opacity-50 transition-all"
            >
              {submitting ? "Memverifikasi..." : "Log in"}
            </button>
          </form>

          <div className="mt-8 rounded-xl bg-[#f1f4fa] p-4 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#06152b]">
              <ShieldCheck size={15} className="text-[#3a36db]" />
              <span>Kredensial Superadmin</span>
            </div>
            <div className="mt-1.5 text-[#788a9a]">
              Username: <code className="font-mono font-bold text-[#06152b]">superadmin</code>
              <br />
              Password: <code className="font-mono font-bold text-[#06152b]">superadmin123</code>
            </div>
          </div>
        </div>
      </div>

      {/* Right Illustration / Overview Panel (#f1f4fa) */}
      <div className="hidden flex-1 flex-col items-center justify-center p-12 lg:flex">
        <div className="max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#3a36db] shadow-xs">
            <Zap size={14} /> Powered by Rust Axum + Next.js
          </div>
          <h2 className="text-4xl font-bold leading-tight text-[#06152b]">
            Platform ERP Modern, Cepat &amp; Terintegrasi
          </h2>
          <p className="text-sm leading-relaxed text-[#788a9a]">
            Mengelola seluruh rantai pasok distribusi pelumas &amp; bahan bakar:
            Permintaan Pembelian, Purchase Order, Sales Order, Gudang, Stok
            Batch, hingga Akuntansi &amp; Keuangan dalam satu sistem API-first.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-xs">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#605cff]/10 text-[#605cff]">
                <BarChart3 size={20} />
              </div>
              <div className="text-sm font-bold">Analitik Real-Time</div>
              <div className="mt-1 text-xs text-[#788a9a]">
                Pantau omzet penjualan, PO, piutang AR, dan hutang AP secara langsung.
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-xs">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#2ee5a7]/15 text-emerald-600">
                <Layers size={20} />
              </div>
              <div className="text-sm font-bold">Database Terpadu</div>
              <div className="mt-1 text-xs text-[#788a9a]">
                Berjalan selaras di atas database PostgreSQL CRA dengan audit log &amp; event outbox.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
