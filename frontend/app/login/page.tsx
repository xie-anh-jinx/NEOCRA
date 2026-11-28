"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isTauriRuntime } from "@/core/tauri-bridge";
import { toast } from "sonner";
import { Download, Lock, User } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDownload = async (
    url: string,
    filename: string,
    notFoundMsg: string,
    errMsg: string
  ) => {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        toast.info(notFoundMsg);
      }
    } catch {
      toast.error(errMsg);
    }
  };

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
            <img
              src="/logo-cra.png"
              alt="PT. Cahaya Resources Abadi"
              className="mb-4 h-20 w-auto object-contain"
            />
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

          {!isTauriRuntime() && (
            <div className="mt-8 border-t border-slate-200/80 pt-6">
              <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#788a9a]">
                <Download size={12} />
                <span>Download Aplikasi NEOCRA</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      "/downloads/NEOCRA-setup.exe",
                      "NEOCRA-setup.exe",
                      "Installer NEOCRA-setup.exe belum tersedia di server.",
                      "Gagal memeriksa file installer NEOCRA-setup.exe"
                    )
                  }
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-xs transition-all hover:border-[#00a4ef] hover:bg-sky-50/40 hover:shadow-md"
                  title="Download Aplikasi Desktop Windows (.exe)"
                >
                  <img
                    src="/logo-windows.png"
                    alt="Windows"
                    className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#06152b]">
                      NEOCRA.exe
                    </div>
                    <div className="text-[10px] text-[#788a9a]">
                      Windows Desktop
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      "/downloads/NEOCRA-android.apk",
                      "NEOCRA-android.apk",
                      "Installer Android NEOCRA-android.apk belum tersedia di server.",
                      "Gagal memeriksa file NEOCRA-android.apk"
                    )
                  }
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-xs transition-all hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-md"
                  title="Download Aplikasi Android NEOCRA (.apk)"
                >
                  <img
                    src="/logo-android.png"
                    alt="Android"
                    className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#06152b]">
                      NEOCRA.apk
                    </div>
                    <div className="text-[10px] text-[#788a9a]">
                      Android Mobile
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Illustration Panel */}
      <div className="relative hidden flex-1 lg:block">
        <img
          src="/balikpapan.jpg"
          alt="Gudang Balikpapan PT. Cahaya Resources Abadi"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
