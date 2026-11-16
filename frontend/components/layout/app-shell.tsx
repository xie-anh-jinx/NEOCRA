"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { canAccessNav, ERP_NAVIGATION } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

function getNavIcon(href: string) {
  if (href === "/dashboard") return <LayoutDashboard size={18} />;
  if (href.startsWith("/master/items")) return <Package size={18} />;
  if (href.startsWith("/master/suppliers")) return <Building2 size={18} />;
  if (href.startsWith("/master/customers")) return <Users size={18} />;
  if (href.startsWith("/master/employees")) return <User size={18} />;
  if (href.startsWith("/inventory/stock-card")) return <Activity size={18} />;
  if (href.startsWith("/inventory")) return <Boxes size={18} />;
  if (href.startsWith("/purchasing/requests")) return <ClipboardList size={18} />;
  if (href.startsWith("/purchasing")) return <ShoppingCart size={18} />;
  if (href.startsWith("/sales/orders")) return <FileText size={18} />;
  if (href.startsWith("/sales/invoices")) return <FileSpreadsheet size={18} />;
  if (href.startsWith("/warehouse/receipts")) return <Warehouse size={18} />;
  if (href.startsWith("/warehouse/deliveries")) return <Truck size={18} />;
  if (href.startsWith("/finance/accounts")) return <BookOpen size={18} />;
  if (href.startsWith("/finance/ar")) return <Wallet size={18} />;
  if (href.startsWith("/finance/ap")) return <CreditCard size={18} />;
  if (href.startsWith("/finance/journals")) return <BarChart3 size={18} />;
  return <Wallet size={18} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f4fa]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#3a36db] border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-[#788a9a]">
            Memuat NEOCRA ERP...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-screen transition-colors",
        darkMode ? "bg-[#222131] text-white" : "bg-[#f1f4fa] text-[#06152b]"
      )}
    >
      {/* Figma-style Sidebar */}
      <aside
        className={cn(
          "flex flex-col transition-all duration-200 border-r",
          darkMode
            ? "bg-[#39394b] border-white/10 text-white"
            : "bg-white border-slate-200/70 text-[#06152b]",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-18 items-center justify-between px-4">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#605cff] to-[#3a36db] font-bold text-white shadow-md shadow-[#3a36db]/25">
                CRA
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight">NEOCRA</div>
                <div className={cn("text-[11px]", darkMode ? "text-[#a1a0b8]" : "text-[#788a9a]")}>
                  Enterprise ERP
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#605cff] to-[#3a36db] font-bold text-white shadow-md">
              C
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              darkMode
                ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                : "text-[#788a9a] hover:bg-[#f1f4fa] hover:text-[#06152b]"
            )}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {ERP_NAVIGATION.map((group) => {
            const visibleItems = group.items.filter((item) =>
              canAccessNav(user, item)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.group}>
                {!collapsed && (
                  <div
                    className={cn(
                      "mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider",
                      darkMode ? "text-[#a1a0b8]" : "text-[#788a9a]"
                    )}
                  >
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
                        title={item.label}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "bg-[#3a36db] text-white shadow-md shadow-[#3a36db]/25"
                            : darkMode
                            ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                            : "text-[#788a9a] hover:bg-[#f1f4fa] hover:text-[#06152b]"
                        )}
                      >
                        <span className={cn("shrink-0", active ? "text-white" : "")}>
                          {getNavIcon(item.href)}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {!collapsed && user && (
          <div
            className={cn(
              "m-3 rounded-xl p-3 text-xs",
              darkMode ? "bg-[#222131]" : "bg-[#f1f4fa]"
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={14} className="text-[#2ee5a7]" />
              <span>
                {user.is_superadmin ? "Superadmin" : `${user.roles.length} Roles`}
              </span>
            </div>
            <div
              className={cn(
                "mt-1 flex items-center gap-3 text-[11px]",
                darkMode ? "text-[#a1a0b8]" : "text-[#788a9a]"
              )}
            >
              <span>{user.branches.length} Cabang</span>
              <span>·</span>
              <span>{user.warehouses.length} Gudang</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header
          className={cn(
            "flex h-16 items-center justify-between px-6 border-b transition-colors",
            darkMode
              ? "bg-[#39394b]/80 border-white/10"
              : "bg-white/80 backdrop-blur border-slate-200/70"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">
              PT. Cahaya Resource Abadi
            </span>
            <span className="hidden sm:inline-flex rounded-full bg-[#605cff]/10 px-2.5 py-0.5 text-xs font-semibold text-[#605cff]">
              NEOCRA v1
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDark}
              className={cn(
                "rounded-xl p-2 transition-colors",
                darkMode
                  ? "bg-[#222131] text-amber-300 hover:bg-white/10"
                  : "bg-[#f1f4fa] text-[#788a9a] hover:text-[#06152b]"
              )}
              title="Toggle Light / Dark Mode"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {user && (
              <div className="flex items-center gap-3 pl-2">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-bold leading-tight">
                    {user.nama}
                  </div>
                  <div
                    className={cn(
                      "text-[11px]",
                      darkMode ? "text-[#a1a0b8]" : "text-[#788a9a]"
                    )}
                  >
                    {user.jabatan || "Administrator"}
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff69b4]/15 text-[#ff69b4] font-bold">
                  <User size={18} />
                </div>
                <button
                  onClick={logout}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                    darkMode
                      ? "bg-[#222131] text-rose-400 hover:bg-rose-500/20"
                      : "bg-[#f1f4fa] text-[#788a9a] hover:bg-rose-50 hover:text-rose-600"
                  )}
                >
                  <LogOut size={14} />
                  <span className="hidden md:inline">Keluar</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
