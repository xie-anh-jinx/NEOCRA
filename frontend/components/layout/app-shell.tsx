"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { canAccessNav, ERP_NAVIGATION } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  User,
  Warehouse,
} from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Memuat NEOCRA ERP...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-slate-200 bg-slate-900 text-slate-100 transition-all duration-200",
          collapsed ? "w-16" : "w-68"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow">
                CRA
              </div>
              <div>
                <div className="text-sm font-bold tracking-wide text-white">
                  NEOCRA ERP
                </div>
                <div className="text-[11px] text-slate-400">
                  PT. Cahaya Resource Abadi
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {ERP_NAVIGATION.map((group) => {
            const visibleItems = group.items.filter((item) =>
              canAccessNav(user, item)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.group}>
                {!collapsed && (
                  <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.group}
                  </div>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        )}
                      >
                        <span className="truncate">
                          {collapsed ? item.label.slice(0, 2) : item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {!collapsed && user && (
          <div className="border-t border-slate-800 p-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>
                {user.is_superadmin ? "Superadmin Access" : `${user.roles.length} Roles`}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <Building2 size={12} /> {user.branches.length} Cabang
              </span>
              <span className="inline-flex items-center gap-1">
                <Warehouse size={12} /> {user.warehouses.length} Gudang
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Corporate Resource Application (NEOCRA v1)
            </span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
              Rust Axum + Next.js
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 text-right">
                <div className="hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800">
                    {user.nama} ({user.username})
                  </div>
                  <div className="text-xs text-slate-500">
                    {user.jabatan || "Administrator"} · {user.kantor || "HO - Balikpapan"}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <User size={18} />
                </div>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors"
              >
                <LogOut size={14} />
                Keluar
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
