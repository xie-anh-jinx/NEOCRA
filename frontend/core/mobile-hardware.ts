import { isTauriRuntime, tauriInvoke } from "@/core/tauri-bridge";

export interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  source: "tauri-geolocation" | "browser-geolocation";
}

export interface BarcodeResult {
  content: string;
  format: string;
}

export interface AndroidUpdateInfo {
  current_version: string;
  current_version_code: number;
  update_available: boolean;
  latest: {
    version: string;
    version_code: number;
    apk_url: string;
    changelog: string;
    force_update: boolean;
  } | null;
}

export async function getRuntimePlatform(): Promise<string> {
  if (!isTauriRuntime()) return "web";
  try {
    return await tauriInvoke<string>("get_runtime_platform");
  } catch {
    return "desktop";
  }
}

export async function scanBarcodeNative(): Promise<BarcodeResult> {
  if (!isTauriRuntime()) {
    throw new Error("Kamera Barcode Scanner native hanya tersedia di aplikasi Android NEOCRA");
  }
  const res = await tauriInvoke<{ content: string; format?: string }>(
    "plugin:barcode-scanner|scan",
    { windowed: false, formats: [] }
  );
  return {
    content: res.content,
    format: res.format || "QR/BARCODE",
  };
}

export async function authenticateBiometricNative(reason: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    throw new Error("Verifikasi biometrik hanya tersedia di perangkat Android/Mobile NEOCRA");
  }
  await tauriInvoke("plugin:biometric|authenticate", {
    reason,
    allowDeviceCredential: true,
    title: "Verifikasi NEOCRA",
    subtitle: "Gunakan sidik jari atau pengenalan wajah",
  });
  return true;
}

export async function getCurrentGpsLocation(): Promise<GpsPosition> {
  if (isTauriRuntime()) {
    try {
      const pos = await tauriInvoke<{
        coords: { latitude: number; longitude: number; accuracy: number };
      }>("plugin:geolocation|get_current_position", {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString(),
        source: "tauri-geolocation",
      };
    } catch {
      // Fall through to Web Geolocation API inside Android WebView
    }
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Layanan GPS/Geolocation tidak tersedia di perangkat ini");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
          source: "browser-geolocation",
        }),
      (err) => reject(new Error(err.message || "Gagal mendapatkan lokasi GPS")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export async function checkAndroidUpdate(): Promise<AndroidUpdateInfo> {
  if (isTauriRuntime()) {
    return tauriInvoke<AndroidUpdateInfo>("check_android_update");
  }
  const res = await fetch("/downloads/android-version.json", { cache: "no-store" });
  if (!res.ok) {
    return {
      current_version: "1.0.0",
      current_version_code: 1,
      update_available: false,
      latest: null,
    };
  }
  const latest = await res.json();
  return {
    current_version: "1.0.0",
    current_version_code: 1,
    update_available: (latest?.version_code ?? 0) > 1,
    latest,
  };
}
