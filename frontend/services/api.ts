import { isTauriRuntime, tauriInvoke, type OutboxItem } from "@/core/tauri-bridge";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "") +
  "/api/v1";

const FASTAPI_BASE = (
  process.env.NEXT_PUBLIC_FASTAPI_URL || "https://warehouse.pengajaran.com/api"
).replace(/\/$/, "");

export const TOKEN_KEY = "neocra_access_token";
export const USER_KEY = "neocra_user_profile";
export const WEB_OUTBOX_KEY = "neocra_local_outbox";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token: string, user: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (isTauriRuntime()) {
    void tauriInvoke("set_active_token", { token }).catch(() => {});
  }
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (isTauriRuntime()) {
    void tauriInvoke("set_active_token", { token: null }).catch(() => {});
  }
}

function inferEntityFromPath(path: string): string {
  const clean = path.replace(/^\/+/, "").split("?")[0];
  const parts = clean.split("/");
  return parts.slice(0, 2).join(".") || "erp";
}

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  let url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        usp.set(k, String(v));
      }
    }
    const qs = usp.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
  const url = buildUrl(API_BASE, path, params);
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = `axum:${method}:${url}`;

  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401 && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        clearStoredSession();
        window.location.href = "/login";
      }
    }

    if (!res.ok) {
      let errMessage = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) {
          errMessage = errJson.error.message;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(errMessage);
    }

    const data = (await res.json()) as T;
    if (method === "GET" && isTauriRuntime()) {
      void tauriInvoke("cache_set", {
        key: cacheKey,
        payloadJson: JSON.stringify(data),
      }).catch(() => {});
    }
    return data;
  } catch (err) {
    // Offline-First Fallback when network is unreachable
    const isNetworkError =
      err instanceof TypeError ||
      (err instanceof Error && /failed to fetch|network|load failed/i.test(err.message));

    if (isNetworkError && isTauriRuntime()) {
      if (method === "GET") {
        const cached = await tauriInvoke<{ payload_json: string } | null>("cache_get", {
          key: cacheKey,
        });
        if (cached?.payload_json) {
          return JSON.parse(cached.payload_json) as T;
        }
      } else {
        // Queue mutation (including approvals) into local_outbox
        const item = await tauriInvoke<OutboxItem>("outbox_enqueue", {
          entity: inferEntityFromPath(path),
          method,
          path: buildUrl("", path, params),
          payloadJson: typeof options.body === "string" ? options.body : "{}",
        });
        return {
          ok: true,
          queued: true,
          outbox_id: item.id,
        } as unknown as T;
      }
    }
    throw err;
  }
}

export async function analyticsFetch<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
  const url = buildUrl(FASTAPI_BASE, path, params);
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    throw new Error(`FastAPI HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
