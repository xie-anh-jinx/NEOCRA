"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { ShieldCheck, X, Check } from "lucide-react";

interface UserListItem {
  usernamenya: string;
  nama: string;
  id_pegawai: string;
  enabled: boolean | null;
  roles: string | null;
  hakakses_roles: string[];
  jabatan: string | null;
  departemen: string | null;
  kantor: string | null;
  jmlogin: number | null;
  loginterbaru: string | null;
}

interface RoleMenuItem {
  id: number;
  name: string;
  roles: string;
  parent: number | null;
}

interface UserRolesResponse {
  username: string;
  user_role: string | null;
  menu_ids: number[];
  roles: string[];
}

export default function SystemUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["system-users", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<UserListItem>>("/users", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["system-roles"],
    queryFn: () => apiFetch<RoleMenuItem[]>("/users/roles"),
  });

  const openEditRoles = async (user: UserListItem) => {
    try {
      const detail = await apiFetch<UserRolesResponse>(
        `/users/${encodeURIComponent(user.usernamenya)}/roles`
      );
      setEditingUser(user);
      setSelectedMenuIds(detail.menu_ids);
      setIsAdminRole(detail.user_role === "ROLE_ADMIN");
      setRoleSearch("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat hak akses user");
    }
  };

  const toggleStatusMutation = useMutation({
    mutationFn: ({ username, enabled }: { username: string; enabled: boolean }) =>
      apiFetch(`/users/${encodeURIComponent(username)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      toast.success("Status pengguna berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status pengguna");
    },
  });

  const saveRolesMutation = useMutation({
    mutationFn: ({
      username,
      user_role,
      menu_ids,
    }: {
      username: string;
      user_role: string | null;
      menu_ids: number[];
    }) =>
      apiFetch(`/users/${encodeURIComponent(username)}/roles`, {
        method: "PUT",
        body: JSON.stringify({ user_role, menu_ids }),
      }),
    onSuccess: () => {
      toast.success("Hak akses & role pengguna berhasil disimpan");
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan hak akses");
    },
  });

  const toggleMenu = (id: number) => {
    setSelectedMenuIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredRoles = allRoles.filter((r) => {
    if (!roleSearch.trim()) return true;
    const term = roleSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.roles.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <ErpTable
        title="Pengguna & Hak Akses"
        subtitle="Daftar pengguna database CRA (tabel pengguna & hakakses) beserta role aktif"
        data={data?.data || []}
        total={data?.meta.total || 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        search={q}
        onSearchChange={(val) => {
          setQ(val);
          setPage(1);
        }}
        loading={isLoading}
        columns={[
          {
            header: "Username",
            accessor: (r) => (
              <div>
                <div className="font-mono font-semibold text-indigo-700">
                  {r.usernamenya}
                </div>
                <div className="text-xs text-slate-400">ID: {r.id_pegawai}</div>
              </div>
            ),
          },
          {
            header: "Nama & Jabatan",
            accessor: (r) => (
              <div>
                <div className="font-medium text-slate-900">{r.nama}</div>
                <div className="text-xs text-slate-500">
                  {[r.jabatan, r.departemen, r.kantor].filter(Boolean).join(" · ") || "-"}
                </div>
              </div>
            ),
          },
          {
            header: "Role Database",
            accessor: (r) => {
              const allUserRoles = Array.from(
                new Set([
                  ...(r.roles ? [r.roles] : []),
                  ...(r.hakakses_roles || []),
                ])
              );
              if (allUserRoles.length === 0) {
                return <span className="text-xs text-slate-400">Belum ada role</span>;
              }
              return (
                <div className="flex flex-wrap gap-1 max-w-md">
                  {allUserRoles.slice(0, 4).map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                    >
                      {role}
                    </span>
                  ))}
                  {allUserRoles.length > 4 && (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      +{allUserRoles.length - 4} lainnya
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            header: "Status",
            accessor: (r) => (
              <button
                type="button"
                onClick={() =>
                  toggleStatusMutation.mutate({
                    username: r.usernamenya,
                    enabled: !(r.enabled ?? false),
                  })
                }
                title="Klik untuk aktifkan / nonaktifkan"
                className="cursor-pointer"
              >
                <StatusBadge status={r.enabled ? "Aktif" : "Nonaktif"} />
              </button>
            ),
          },
          {
            header: "Aksi",
            accessor: (r) => (
              <button
                type="button"
                onClick={() => openEditRoles(r)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3a36db] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2f2bc2] transition-colors"
              >
                <ShieldCheck size={14} />
                Atur Role
              </button>
            ),
          },
        ]}
      />

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Atur Role — {editingUser.nama}
                </h2>
                <p className="text-xs text-slate-500">
                  Username: <span className="font-mono font-semibold">{editingUser.usernamenya}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <label className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-indigo-950">
                    Superadmin / Full Access (ROLE_ADMIN)
                  </div>
                  <div className="text-xs text-indigo-700">
                    Memberikan akses penuh ke seluruh modul dan manajemen pengguna
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAdminRole}
                  onChange={(e) => setIsAdminRole(e.target.checked)}
                  className="h-4 w-4 accent-[#3a36db]"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Hak Akses Menu &amp; Role ({selectedMenuIds.length} dipilih)
                  </span>
                  <input
                    type="text"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    placeholder="Cari nama menu atau ROLE_..."
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#3a36db] focus:outline-none"
                  />
                </div>

                <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                  {filteredRoles.map((item) => {
                    const checked = selectedMenuIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleMenu(item.id)}
                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                          checked
                            ? "border-[#3a36db] bg-[#3a36db]/5"
                            : "border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-[#3a36db] bg-[#3a36db] text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {checked && <Check size={12} />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-800">
                            {item.name}
                          </div>
                          <div className="truncate font-mono text-[10px] text-slate-500">
                            {item.roles}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={saveRolesMutation.isPending}
                onClick={() =>
                  saveRolesMutation.mutate({
                    username: editingUser.usernamenya,
                    user_role: isAdminRole ? "ROLE_ADMIN" : null,
                    menu_ids: selectedMenuIds,
                  })
                }
                className="rounded-xl bg-[#3a36db] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2f2bc2] disabled:opacity-50"
              >
                {saveRolesMutation.isPending ? "Menyimpan..." : "Simpan Hak Akses"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
