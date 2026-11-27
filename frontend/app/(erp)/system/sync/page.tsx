"use client";

import React, { useEffect, useState } from "react";
import {
  isTauriRuntime,
  tauriInvoke,
  type ConnectionSnapshot,
  type DesktopConfig,
  type OutboxItem,
  type PluginManifest,
  type SyncReport,
} from "@/core/tauri-bridge";
import { toast } from "sonner";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Plug,
  Bot,
  RotateCcw,
  Trash2,
  Save,
} from "lucide-react";

export default function SyncCenterPage() {
  const inTauri = isTauriRuntime();
  const [conn, setConn] = useState<ConnectionSnapshot | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [config, setConfig] = useState<DesktopConfig | null>(null);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);

  const loadAll = async () => {
    if (!inTauri) return;
    try {
      const [c, o, cfg, pl] = await Promise.all([
        tauriInvoke<ConnectionSnapshot>("get_connection_status"),
        tauriInvoke<OutboxItem[]>("outbox_list", { status: null }),
        tauriInvoke<DesktopConfig>("get_desktop_config"),
        tauriInvoke<PluginManifest[]>("list_plugins"),
      ]);
      setConn(c);
      setOutbox(o);
      setConfig(cfg);
      setPlugins(pl);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat status desktop");
    }
  };

  useEffect(() => {
    void loadAll();
  }, [inTauri]);

  const handleManualSync = async () => {
    if (!inTauri) return;
    setSyncing(true);
    try {
      const report = await tauriInvoke<SyncReport>("trigger_sync");
      setLastReport(report);
      toast.success(
        `Sinkronisasi selesai: ${report.pushed_ok} terkirim, ${report.pulled_rows} baris diperbarui`
      );
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sinkronisasi gagal");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inTauri || !config) return;
    try {
      await tauriInvoke("save_desktop_config", { newConfig: config });
      toast.success("Konfigurasi desktop disimpan");
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi");
    }
  };

  const handleRetry = async (id: string) => {
    await tauriInvoke("outbox_retry", { id });
    toast.success("Item dijadwalkan ulang untuk sinkronisasi");
    await loadAll();
  };

  const handleDiscard = async (id: string) => {
    await tauriInvoke("outbox_discard", { id });
    toast.success("Item antrean dibatalkan");
    await loadAll();
  };

  if (!inTauri) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-xs dark:bg-[#39394b]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3a36db]/10 text-[#3a36db] dark:bg-[#605cff]/20 dark:text-[#8b88ff]">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sync Center &amp; Mode Offline</h1>
            <p className="text-xs text-[#788a9a] dark:text-[#a1a0b8]">
              Fitur database lokal SQLCipher, antrean `local_outbox`, dan sinkronisasi offline aktif pada aplikasi desktop **NEOCRA.exe** (Tauri v2).
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-[#f1f4fa] p-4 text-xs text-[#788a9a] dark:bg-[#222131] dark:text-[#a1a0b8]">
          Saat ini Anda mengakses NEOCRA melalui browser web (mode online langsung ke Rust Axum API + FastAPI). Jalankan `NEOCRA.exe` di Windows untuk menggunakan mode Offline-First.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Center &amp; Desktop</h1>
          <p className="text-xs text-[#788a9a] dark:text-[#a1a0b8]">
            Status koneksi Rust Axum API &amp; FastAPI, antrean `local_outbox`, plugin, dan konfigurasi offline
          </p>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={handleManualSync}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3a36db] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#2f2bc2] disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Menyinkronkan..." : "Sinkronkan Sekarang"}
        </button>
      </div>

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-xs dark:bg-[#39394b]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#788a9a] dark:text-[#a1a0b8]">Status Koneksi</span>
            {conn?.state === "offline" ? (
              <WifiOff size={18} className="text-rose-500" />
            ) : (
              <Wifi size={18} className="text-emerald-500" />
            )}
          </div>
          <div className="mt-2 text-lg font-bold uppercase">{conn?.state || "-"}</div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-xs dark:bg-[#39394b]">
          <div className="text-xs font-semibold text-[#788a9a] dark:text-[#a1a0b8]">Rust Axum API</div>
          <div className="mt-2 text-lg font-bold">
            {conn?.axum_reachable ? "Terhubung" : "Offline"}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-xs dark:bg-[#39394b]">
          <div className="text-xs font-semibold text-[#788a9a] dark:text-[#a1a0b8]">FastAPI Analytics</div>
          <div className="mt-2 text-lg font-bold">
            {conn?.fastapi_reachable ? "Terhubung" : "Offline"}
          </div>
        </div>
      </div>

      {lastReport && (
        <div className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
          Sinkronisasi terakhir: {lastReport.pushed_ok} mutasi terkirim, {lastReport.pushed_conflict} konflik, {lastReport.pulled_rows} baris diperbarui ({lastReport.pulled_entities} entitas).
        </div>
      )}

      {/* Local Outbox Queue */}
      <div className="rounded-2xl bg-white p-6 shadow-xs dark:bg-[#39394b]">
        <h2 className="mb-4 text-base font-bold">Antrean Offline (`local_outbox`)</h2>
        {outbox.length === 0 ? (
          <p className="text-xs text-[#788a9a] dark:text-[#a1a0b8]">
            Tidak ada antrean mutasi offline. Semua data sudah tersinkronisasi.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[#788a9a] dark:border-white/10">
                  <th className="pb-2">Entitas</th>
                  <th className="pb-2">Aksi</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Retry</th>
                  <th className="pb-2">Error</th>
                  <th className="pb-2 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {outbox.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 font-mono font-semibold">{item.entity}</td>
                    <td className="py-2.5 font-mono">
                      {item.method} {item.path}
                    </td>
                    <td className="py-2.5 uppercase font-semibold">{item.status}</td>
                    <td className="py-2.5">{item.retry_count}</td>
                    <td className="py-2.5 text-rose-500 max-w-xs truncate">
                      {item.last_error || "-"}
                    </td>
                    <td className="py-2.5 text-right space-x-2">
                      {(item.status === "failed" || item.status === "conflict") && (
                        <button
                          type="button"
                          onClick={() => handleRetry(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#3a36db]/10 px-2.5 py-1 font-semibold text-[#3a36db] dark:text-[#8b88ff]"
                        >
                          <RotateCcw size={12} /> Retry
                        </button>
                      )}
                      {item.status !== "synced" && (
                        <button
                          type="button"
                          onClick={() => handleDiscard(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                        >
                          <Trash2 size={12} /> Batal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config & Plugins */}
      {config && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleSaveConfig} className="rounded-2xl bg-white p-6 shadow-xs dark:bg-[#39394b] space-y-4">
            <h2 className="text-base font-bold">Konfigurasi Endpoint &amp; Sync</h2>
            <div>
              <label className="mb-1 block text-xs font-semibold">Rust Axum API URL</label>
              <input
                type="text"
                value={config.api_url}
                onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                className="w-full rounded-xl bg-[#f1f4fa] px-3.5 py-2 text-xs dark:bg-[#222131]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">FastAPI Analytics URL</label>
              <input
                type="text"
                value={config.analytics_api_url}
                onChange={(e) => setConfig({ ...config, analytics_api_url: e.target.value })}
                className="w-full rounded-xl bg-[#f1f4fa] px-3.5 py-2 text-xs dark:bg-[#222131]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Interval Sync (detik)</label>
                <input
                  type="number"
                  min={30}
                  value={config.sync_interval_secs}
                  onChange={(e) =>
                    setConfig({ ...config, sync_interval_secs: Number(e.target.value) })
                  }
                  className="w-full rounded-xl bg-[#f1f4fa] px-3.5 py-2 text-xs dark:bg-[#222131]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Release Channel</label>
                <select
                  value={config.release_channel}
                  onChange={(e) => setConfig({ ...config, release_channel: e.target.value })}
                  className="w-full rounded-xl bg-[#f1f4fa] px-3.5 py-2 text-xs dark:bg-[#222131]"
                >
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={config.ai_enabled}
                onChange={(e) => setConfig({ ...config, ai_enabled: e.target.checked })}
              />
              <Bot size={14} /> Aktifkan AI Assistant ({config.ai_provider})
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#3a36db] px-4 py-2 text-xs font-semibold text-white"
            >
              <Save size={14} /> Simpan Konfigurasi
            </button>
          </form>

          <div className="rounded-2xl bg-white p-6 shadow-xs dark:bg-[#39394b] space-y-3">
            <div className="flex items-center gap-2">
              <Plug size={16} className="text-[#3a36db] dark:text-[#8b88ff]" />
              <h2 className="text-base font-bold">Plugin &amp; Hardware Readiness</h2>
            </div>
            <div className="space-y-2">
              {plugins.map((pl) => (
                <div
                  key={pl.id}
                  className="flex items-center justify-between rounded-xl bg-[#f1f4fa] p-3 text-xs dark:bg-[#222131]"
                >
                  <div>
                    <div className="font-semibold">{pl.name}</div>
                    <div className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                      {pl.description}
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      pl.enabled
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                    }`}
                  >
                    {pl.enabled ? "Aktif" : "Siap"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
