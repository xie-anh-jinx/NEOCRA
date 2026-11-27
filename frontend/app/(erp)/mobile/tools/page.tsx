"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  authenticateBiometricNative,
  checkAndroidUpdate,
  getCurrentGpsLocation,
  getRuntimePlatform,
  scanBarcodeNative,
  type AndroidUpdateInfo,
  type BarcodeResult,
  type GpsPosition,
} from "@/core/mobile-hardware";
import { isTauriRuntime, tauriInvoke } from "@/core/tauri-bridge";
import { useAuth } from "@/hooks/use-auth";
import {
  Download,
  Fingerprint,
  MapPin,
  RefreshCw,
  ScanLine,
  Smartphone,
} from "lucide-react";

export default function MobileToolsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [platform, setPlatform] = useState("web");
  const [lastScan, setLastScan] = useState<BarcodeResult | null>(null);
  const [gps, setGps] = useState<GpsPosition | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<AndroidUpdateInfo | null>(null);

  useEffect(() => {
    void getRuntimePlatform().then(setPlatform);
  }, []);

  const handleScanBarcode = async () => {
    setBusy("scan");
    try {
      const res = await scanBarcodeNative();
      setLastScan(res);
      toast.success(`Terbaca: ${res.content}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal scan barcode");
    } finally {
      setBusy(null);
    }
  };

  const handleBiometric = async () => {
    setBusy("bio");
    try {
      await authenticateBiometricNative("Konfirmasi identitas pengguna NEOCRA");
      toast.success("Verifikasi biometrik berhasil");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verifikasi biometrik gagal");
    } finally {
      setBusy(null);
    }
  };

  const handleCheckInGps = async () => {
    setBusy("gps");
    try {
      const pos = await getCurrentGpsLocation();
      setGps(pos);
      if (isTauriRuntime()) {
        await tauriInvoke("outbox_enqueue", {
          entity: "hr.attendance",
          method: "POST",
          path: "/hr/attendance/checkin",
          payloadJson: JSON.stringify({
            username: user?.username,
            id_pegawai: user?.id_pegawai,
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
            captured_at: pos.timestamp,
          }),
        });
        toast.success("Lokasi GPS terekam & masuk antrean sinkronisasi offline");
      } else {
        toast.success(
          `Lokasi GPS: ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal merekam GPS");
    } finally {
      setBusy(null);
    }
  };

  const handleCheckUpdate = async () => {
    setBusy("update");
    try {
      const info = await checkAndroidUpdate();
      setUpdateInfo(info);
      if (info.update_available && info.latest) {
        toast.info(`Versi baru v${info.latest.version} tersedia untuk diunduh`);
      } else {
        toast.success(`Aplikasi sudah versi terbaru (v${info.current_version})`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memeriksa update APK");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Mobile Field Tools</h1>
          <p className="text-xs text-[#788a9a] dark:text-[#a1a0b8]">
            Fitur native Android: Barcode/QR Scanner, Absensi GPS, Biometrik, dan Update APK
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3a36db]/10 px-3 py-1 text-[11px] font-bold uppercase text-[#3a36db] dark:text-[#8b88ff]">
          <Smartphone size={13} />
          {platform}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {/* Barcode / QR Scanner */}
        <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-[#39394b] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3a36db]/12 text-[#3a36db] dark:text-[#8b88ff]">
              <ScanLine size={20} />
            </div>
            <div>
              <div className="text-sm font-bold">Barcode &amp; QR Scanner</div>
              <div className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                Scan kode barang / Delivery Order
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy === "scan"}
            onClick={handleScanBarcode}
            className="w-full rounded-xl bg-[#3a36db] py-2.5 text-xs font-semibold text-white hover:bg-[#2f2bc2] disabled:opacity-50"
          >
            {busy === "scan" ? "Membuka Kamera..." : "Mulai Scan Barcode"}
          </button>
          {lastScan && (
            <div className="rounded-xl bg-[#f1f4fa] p-3 text-xs dark:bg-[#222131] space-y-2">
              <div className="font-mono font-bold break-all">{lastScan.content}</div>
              <button
                type="button"
                onClick={() =>
                  router.push(`/inventory/stock?q=${encodeURIComponent(lastScan.content)}`)
                }
                className="text-[11px] font-semibold text-[#3a36db] dark:text-[#8b88ff] hover:underline"
              >
                Cari di Stok Gudang →
              </button>
            </div>
          )}
        </div>

        {/* Absensi GPS */}
        <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-[#39394b] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2ee5a7]/15 text-emerald-600">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-sm font-bold">Absensi GPS Lapangan</div>
              <div className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                Rekam koordinat kehadiran (support offline)
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy === "gps"}
            onClick={handleCheckInGps}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === "gps" ? "Mengambil Lokasi..." : "Check-In GPS Sekarang"}
          </button>
          {gps && (
            <div className="rounded-xl bg-[#f1f4fa] p-3 text-[11px] font-mono dark:bg-[#222131]">
              Lat: {gps.latitude.toFixed(6)}, Lng: {gps.longitude.toFixed(6)} (±{Math.round(gps.accuracy)}m)
            </div>
          )}
        </div>

        {/* Biometrik */}
        <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-[#39394b] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff69b4]/15 text-[#ff69b4]">
              <Fingerprint size={20} />
            </div>
            <div>
              <div className="text-sm font-bold">Biometrik (Sidik Jari / Wajah)</div>
              <div className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                Otentikasi cepat untuk login &amp; approval
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy === "bio"}
            onClick={handleBiometric}
            className="w-full rounded-xl bg-[#f1f4fa] py-2.5 text-xs font-semibold text-[#06152b] hover:bg-slate-200 dark:bg-[#222131] dark:text-white disabled:opacity-50"
          >
            {busy === "bio" ? "Memverifikasi..." : "Uji Verifikasi Biometrik"}
          </button>
        </div>

        {/* Android Self-Update */}
        <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-[#39394b] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <RefreshCw size={20} />
            </div>
            <div>
              <div className="text-sm font-bold">Update Aplikasi Android (APK)</div>
              <div className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                Cek versi terbaru dari server VPS CRA
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy === "update"}
            onClick={handleCheckUpdate}
            className="w-full rounded-xl bg-[#f1f4fa] py-2.5 text-xs font-semibold text-[#06152b] hover:bg-slate-200 dark:bg-[#222131] dark:text-white disabled:opacity-50"
          >
            {busy === "update" ? "Memeriksa..." : "Cek Update APK"}
          </button>
          {updateInfo?.latest && (
            <div className="rounded-xl bg-[#f1f4fa] p-3 text-xs dark:bg-[#222131] space-y-1.5">
              <div className="font-semibold">
                Versi Server: v{updateInfo.latest.version} (code {updateInfo.latest.version_code})
              </div>
              <div className="text-[11px] text-[#788a9a] dark:text-[#a1a0b8]">
                {updateInfo.latest.changelog}
              </div>
              <a
                href={updateInfo.latest.apk_url}
                download
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#3a36db] dark:text-[#8b88ff] hover:underline"
              >
                <Download size={12} /> Download APK v{updateInfo.latest.version}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
