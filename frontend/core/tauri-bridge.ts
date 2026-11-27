export type ConnectionState =
  | "online"
  | "offline"
  | "reconnect"
  | "synchronizing"
  | "synchronized";

export interface ConnectionSnapshot {
  state: ConnectionState;
  axum_reachable: boolean;
  fastapi_reachable: boolean;
  last_checked_at: string;
}

export interface OutboxItem {
  id: string;
  idempotency_key: string;
  entity: string;
  method: string;
  path: string;
  payload_json: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  next_retry_at: string | null;
}

export interface DesktopConfig {
  api_url: string;
  analytics_api_url: string;
  environment: string;
  company_name: string;
  theme: string;
  language: string;
  sync_interval_secs: number;
  offline_max_days: number;
  cache_retention_months: number;
  release_channel: string;
  enabled_plugins: string[];
  ai_enabled: boolean;
  ai_provider: string;
}

export interface SyncReport {
  pushed_ok: number;
  pushed_conflict: number;
  pushed_failed: number;
  pulled_entities: number;
  pulled_rows: number;
  finished_at: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  category: string;
  version: string;
  enabled: boolean;
  description: string;
}

interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__)
  );
}

export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const internals = (
    window as unknown as { __TAURI_INTERNALS__?: TauriInternals }
  ).__TAURI_INTERNALS__;
  if (!internals) {
    throw new Error("Tauri runtime tidak tersedia");
  }
  return internals.invoke<T>(cmd, args);
}
