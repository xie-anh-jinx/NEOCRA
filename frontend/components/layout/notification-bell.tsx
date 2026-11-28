"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Settings,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { apiFetch, getApiBaseUrl, getStoredToken } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type {
  NotificationItem,
  NotificationPushEvent,
  PaginatedResponse,
  UnreadCountResponse,
} from "@/types";

type TabFilter = "pending" | "unread" | "all";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "Baru saja";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export function NotificationBell({ darkMode }: { darkMode: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabFilter>("pending");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: counts } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => apiFetch<UnreadCountResponse>("/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ["notifications", tab],
    queryFn: () =>
      apiFetch<PaginatedResponse<NotificationItem>>(
        "/notifications",
        {},
        {
          page: 1,
          per_page: 20,
          pending_only: tab === "pending" ? true : undefined,
          unread_only: tab === "unread" ? true : undefined,
        }
      ),
    enabled: !!user && open,
  });

  // Real-time Server-Sent Events (SSE) subscription
  useEffect(() => {
    if (!user) return;
    const token = getStoredToken();
    if (!token || token === "offline-session") return;

    const url = `${getApiBaseUrl()}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener("unread_count", (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as UnreadCountResponse;
        queryClient.setQueryData(["notifications-unread"], parsed);
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener("notification", (ev) => {
      try {
        const push = JSON.parse((ev as MessageEvent).data) as NotificationPushEvent;
        queryClient.setQueryData(["notifications-unread"], {
          unread: push.unread,
          pending_approvals: push.pending_approvals,
        });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["reporting-dashboard"] });

        toast.info(push.notification.title, {
          description: push.notification.message,
          duration: 6000,
          action: {
            label: "Lihat",
            onClick: () => router.push(push.notification.action_url),
          },
        });
      } catch {
        // ignore parse error
      }
    });

    return () => {
      es.close();
    };
  }, [user, queryClient, router]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<UnreadCountResponse>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: (nextCounts) => {
      queryClient.setQueryData(["notifications-unread"], nextCounts);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiFetch<UnreadCountResponse>("/notifications/read-all", { method: "POST" }),
    onSuccess: (nextCounts) => {
      queryClient.setQueryData(["notifications-unread"], nextCounts);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Semua notifikasi ditandai telah dibaca");
    },
  });

  const handleOpenItem = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }
    setOpen(false);
    router.push(item.action_url);
  };

  const unread = counts?.unread ?? 0;
  const pending = counts?.pending_approvals ?? 0;
  const badgeNum = unread > 0 ? unread : pending;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative rounded-xl p-2 transition-colors",
          darkMode
            ? "bg-[#222131] text-[#a1a0b8] hover:bg-white/10 hover:text-white"
            : "bg-[#f1f4fa] text-[#5a6a7e] hover:bg-slate-200/70 hover:text-[#06152b]"
        )}
        title="Notifikasi Approval"
        aria-label="Notifikasi Approval"
      >
        <Bell size={16} />
        {badgeNum > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow",
              unread > 0 ? "bg-rose-500" : "bg-amber-500"
            )}
          >
            {badgeNum > 99 ? "99+" : badgeNum}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "fixed right-3 top-16 z-50 w-[calc(100vw-24px)] max-w-md rounded-2xl border shadow-2xl sm:absolute sm:right-0 sm:top-12 sm:w-96",
            darkMode
              ? "border-white/10 bg-[#2c2b3d] text-white"
              : "border-slate-200 bg-white text-[#06152b]"
          )}
        >
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between border-b px-4 py-3",
              darkMode ? "border-white/10" : "border-slate-100"
            )}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <span>Notifikasi Approval</span>
                {pending > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {pending} Menunggu
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#788a9a]">
                Real-time antrean persetujuan PP, PO, dan SO
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  title="Tandai semua dibaca"
                  className={cn(
                    "rounded-lg p-1.5 text-xs transition-colors",
                    darkMode
                      ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <CheckCheck size={15} />
                </button>
              )}
              {user?.is_superadmin && (
                <Link
                  href="/system/approvals"
                  onClick={() => setOpen(false)}
                  title="Aturan Routing Approval"
                  className={cn(
                    "rounded-lg p-1.5 text-xs transition-colors",
                    darkMode
                      ? "text-[#a1a0b8] hover:bg-white/10 hover:text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Settings size={15} />
                </Link>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div
            className={cn(
              "grid grid-cols-3 gap-1 border-b p-2 text-xs font-semibold",
              darkMode ? "border-white/10 bg-[#222131]/50" : "border-slate-100 bg-slate-50/70"
            )}
          >
            {(
              [
                { id: "pending", label: `Perlu Approval (${pending})` },
                { id: "unread", label: `Belum Dibaca (${unread})` },
                { id: "all", label: "Semua" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-[11px] transition-colors truncate",
                  tab === t.id
                    ? "bg-[#3a36db] text-white shadow-xs"
                    : darkMode
                    ? "text-[#a1a0b8] hover:bg-white/10"
                    : "text-slate-600 hover:bg-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-[#788a9a]">
                Memuat notifikasi...
              </div>
            ) : !listData?.data?.length ? (
              <div className="p-8 text-center">
                <Bell size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {tab === "pending"
                    ? "Tidak ada approval yang menunggu Anda"
                    : "Belum ada notifikasi"}
                </div>
              </div>
            ) : (
              listData.data.map((item) => {
                const isRejected =
                  item.title.toLowerCase().includes("ditolak") ||
                  item.metadata?.approve === false;
                const Icon =
                  item.category === "approval_needed"
                    ? ShieldAlert
                    : isRejected
                    ? XCircle
                    : item.category === "approval_result"
                    ? CheckCircle2
                    : Clock;
                const iconColor =
                  item.category === "approval_needed"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : isRejected
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    : item.category === "approval_result"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenItem(item)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      !item.is_read
                        ? darkMode
                          ? "bg-[#3a36db]/15 hover:bg-[#3a36db]/25"
                          : "bg-indigo-50/50 hover:bg-indigo-50"
                        : darkMode
                        ? "hover:bg-white/5"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        iconColor
                      )}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-bold leading-snug line-clamp-1">
                          {item.title}
                        </div>
                        {!item.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#3a36db]" />
                        )}
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px] leading-relaxed line-clamp-2",
                          darkMode ? "text-[#c4c3d6]" : "text-slate-600"
                        )}
                      >
                        {item.message}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-[#788a9a]">
                        <span className="font-mono font-semibold text-[#3a36db] dark:text-[#8b88ff]">
                          {item.document_number}
                        </span>
                        <span>·</span>
                        <span>{formatRelativeTime(item.created_at)}</span>
                        {(item.category === "approval_needed" ||
                          item.category === "action_needed") && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 font-semibold",
                              item.action_taken_at
                                ? "bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            )}
                          >
                            {item.action_taken_at ? "Sudah Diproses" : "Menunggu Anda"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
