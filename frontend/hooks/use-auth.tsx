"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import type { LoginResponse, UserProfile } from "@/types";
import {
  apiFetch,
  clearStoredSession,
  getStoredToken,
  setStoredSession,
  USER_KEY,
} from "@/services/api";
import { useRouter } from "next/navigation";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
          },
        },
      })
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await apiFetch<UserProfile>("/auth/me");
      setUser(profile);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
    } catch {
      clearStoredSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached =
      typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null;
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        // ignore
      }
    }
    refreshProfile();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setStoredSession(res.access_token, res.user);
    setUser(res.user);
    router.push("/dashboard");
  };

  const logout = () => {
    clearStoredSession();
    setUser(null);
    router.push("/login");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{ user, loading, login, logout, refreshProfile }}
      >
        {children}
        <Toaster richColors position="top-right" />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}
