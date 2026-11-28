"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/services/api";
import { uploadUserAvatar } from "@/lib/avatar";
import { mapMenuOutcomeToHref } from "@/lib/permissions";
import type { MenuNode } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarOff,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Timer,
  Truck,
  User,
  UserX,
  Users,
  Wallet,
  Warehouse,
  Wifi,
  X,
} from "lucide-react";

const PROFILE_MENU_ITEMS = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Absen", href: "/module?name=Absen&outcome=/hr/calender/attendance.jsf", icon: CalendarCheck },
  { label: "Lembur", href: "/module?name=Lembur&outcome=/hr/calender/overtime.jsf", icon: Clock },
  { label: "Izin Tidak Absen", href: "/module?name=Izin+Tidak+Absen&outcome=/hr/calender/izinabsen.jsf", icon: UserX },
  { label: "Izin Terlambat", href: "/module?name=Izin+Terlambat&outcome=/hr/calender/izintelat.jsf", icon: Timer },
  { label: "Cuti", href: "/module?name=Cuti&outcome=/hr/calender/timeoff.jsf", icon: CalendarOff },
  { label: "Perjalanan Dinas", href: "/module?name=Perjalanan+Dinas&outcome=/hr/calender/perjalanandinas.jsf", icon: Briefcase },
  { label: "Slip Gaji", href: "/module?name=Slip+Gaji&outcome=/hr/calender/mysalary.jsf", icon: Receipt },
];

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
  if (href.startsWith("/system/users")) return <ShieldCheck size={18} />;
  return <Wallet size={18} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, refreshProfile } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});
  const [profileMenuOpen, setProfileMenuOpen] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      await uploadUserAvatar(file);
      await refreshProfile();
      toast.success("Foto profil berhasil diperbarui");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal upload foto");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const { data: dbMenus = [] } = useQuery({
    queryKey: ["auth-menus", user?.username],
    queryFn: () => apiFetch<MenuNode[]>("/auth/menus"),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const toggleGroup = (id: number) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      {/* Figma-style Responsive Sidebar (Drawer on mobile, fixed rail on desktop) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 border-r md:static md:translate-x-0",
          darkMode
            ? "bg-[#39394b] border-white/10 text-white"
            : "bg-white border-slate-200/70 text-[#06152b]",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-18 items-center justify-between px-4">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <img
                src="/logo-cra.png"
                alt="PT. Cahaya Resources Abadi"
                className="h-10 w-10 rounded-xl bg-white p-1 object-contain shadow-xs"
              />
              <div>
                <div className="text-sm font-bold tracking-tight">NEOCRA</div>
                <div className={cn("text-[11px]", darkMode ? "text-[#a1a0b8]" : "text-[#788a9a]")}>
                  Enterprise ERP
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <img
              src="/logo-cra.png"
              alt="PT. Cahaya Resources Abadi"
              className="mx-auto h-10 w-10 rounded-xl bg-white p-1 object-contain shadow-xs"
            />
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

        {/* Sidebar User Profile & Personal Menu */}
        {user && (
          <div
            className={cn(
              "mx-3 mb-2 rounded-2xl border p-2.5 transition-colors",
              darkMode
                ? "border-white/10 bg-[#222131]"
                : "border-slate-200/70 bg-[#f1f4fa]"
            )}
          >
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.nama}
                    className="h-10 w-10 rounded-xl object-cover shadow-xs"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3a36db]/15 text-[#3a36db] font-bold">
                    <User size={18} />
                  </div>
                )}
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  title="Upload Foto Profil"
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3a36db] text-white shadow hover:bg-[#2f2bc2] disabled:opacity-50"
                >
                  <Camera size={10} />
                </button>
              </div>

              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="flex min-w-0 flex-1 items-center justify-between text-left"
                >
                  <div className="min-w-0 pr-1">
                    <div className="truncate text-xs font-bold leading-tight">
                      {user.nama}
                    </div>
                    <div
                      className={cn(
                        "truncate text-[10px]",
                        darkMode ? "text-[#a1a0b8]" : "text-[#788a9a]"
                      )}
                    >
                      {user.jabatan || "Administrator"}
                    </div>
                  </div>
                  {profileMenuOpen ? (
                    <ChevronDown size={14} className="shrink-0 text-[#788a9a]" />
                  ) : (
                    <ChevronRight size={14} className="shrink-0 text-[#788a9a]" />
                  )}
                </button>
              )}
            </div>

            {!collapsed && profileMenuOpen && (
              <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2">
                {PROFILE_MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-[#3a36db] text-white"
                          : darkMode
                          ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                          : "text-[#5a6a7e] hover:bg-white hover:text-[#06152b]"
                      )}
                    >
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={logout}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    darkMode
                      ? "text-rose-400 hover:bg-rose-500/20"
                      : "text-rose-600 hover:bg-rose-50"
                  )}
                >
                  <LogOut size={14} className="shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {dbMenus.map((group) => {
            if (group.children.length === 0) {
              const href = mapMenuOutcomeToHref(group);
              const active =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={group.id}
                  href={href}
                  title={group.name}
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
                    {getNavIcon(href)}
                  </span>
                  {!collapsed && <span className="truncate">{group.name}</span>}
                </Link>
              );
            }

            const hasActiveChild = group.children.some((child) => {
              const href = mapMenuOutcomeToHref(child);
              return pathname === href || pathname.startsWith(href + "/");
            });
            const isOpen = openGroups[group.id] ?? hasActiveChild;

            return (
              <div key={group.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
                    darkMode
                      ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                      : "text-[#788a9a] hover:bg-[#f1f4fa] hover:text-[#06152b]"
                  )}
                >
                  {!collapsed ? (
                    <>
                      <span className="truncate">{group.name}</span>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </>
                  ) : (
                    <span className="mx-auto text-[10px]">
                      {group.name.slice(0, 2)}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1">
                    {group.children.map((child) => {
                      const href = mapMenuOutcomeToHref(child);
                      const active =
                        pathname === href || pathname.startsWith(href + "/");
                      return (
                        <Link
                          key={child.id}
                          href={href}
                          title={child.name}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                            active
                              ? "bg-[#3a36db] text-white shadow-md shadow-[#3a36db]/25"
                              : darkMode
                              ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                              : "text-[#788a9a] hover:bg-[#f1f4fa] hover:text-[#06152b]"
                          )}
                        >
                          <span className={cn("shrink-0", active ? "text-white" : "")}>
                            {getNavIcon(href)}
                          </span>
                          {!collapsed && <span className="truncate">{child.name}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {user?.is_superadmin && (
            <div className="pt-2 space-y-1 border-t border-slate-200/60">
              <Link
                href="/system/users"
                title="Pengguna & Hak Akses"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/system/users")
                    ? "bg-[#3a36db] text-white shadow-md shadow-[#3a36db]/25"
                    : darkMode
                    ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                    : "text-[#788a9a] hover:bg-[#f1f4fa] hover:text-[#06152b]"
                )}
              >
                <span className={cn("shrink-0", pathname.startsWith("/system/users") ? "text-white" : "")}>
                  <ShieldCheck size={18} />
                </span>
                {!collapsed && <span className="truncate">Pengguna &amp; Hak Akses</span>}
              </Link>
              <Link
                href="/system/approvals"
                title="Aturan Notifikasi Approval"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname.startsWith("/system/approvals")
                    ? "bg-[#3a36db] text-white shadow-md shadow-[#3a36db]/25"
                    : darkMode
                    ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                    : "text-[#788a9a] hover:bg-[#f1f4fa] hover:text-[#06152b]"
                )}
              >
                <span className={cn("shrink-0", pathname.startsWith("/system/approvals") ? "text-white" : "")}>
                  <Bell size={18} />
                </span>
                {!collapsed && <span className="truncate">Notifikasi Approval</span>}
              </Link>
            </div>
          )}
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
            "flex h-14 md:h-16 items-center justify-between px-4 md:px-6 border-b transition-colors pt-[env(safe-area-inset-top)]",
            darkMode
              ? "bg-[#39394b]/80 border-white/10"
              : "bg-white/80 backdrop-blur border-slate-200/70"
          )}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className={cn(
                "rounded-xl p-2 md:hidden",
                darkMode
                  ? "bg-[#222131] text-white"
                  : "bg-[#f1f4fa] text-[#06152b]"
              )}
              aria-label="Toggle Menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="text-xs sm:text-sm font-bold truncate">
              PT. Cahaya Resource Abadi
            </span>
            <span className="hidden sm:inline-flex rounded-full bg-[#605cff]/10 px-2.5 py-0.5 text-xs font-semibold text-[#605cff]">
              NEOCRA v1
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <NotificationBell darkMode={darkMode} />
            <Link
              href="/system/sync"
              title="Status Koneksi & Sync Center"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                darkMode
                  ? "bg-[#222131] text-emerald-400 hover:bg-white/10"
                  : "bg-[#f1f4fa] text-emerald-700 hover:bg-slate-200/70"
              )}
            >
              <Wifi size={14} />
              <span className="hidden sm:inline">Sync Center</span>
            </Link>
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
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        <MobileBottomNav darkMode={darkMode} />
      </div>
    </div>
  );
}
