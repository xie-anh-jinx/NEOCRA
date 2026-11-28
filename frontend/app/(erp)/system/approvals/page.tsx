"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Plus, Send, Trash2 } from "lucide-react";
import { apiFetch } from "@/services/api";
import type { ApprovalRuleDto } from "@/types";
import { formatIDR } from "@/lib/utils";

interface PositionOption {
  id_jabatan: number;
  jabatan: string;
}

const MODULE_STAGES: Record<string, { value: string; label: string }[]> = {
  "purchasing.pp": [
    { value: "spv", label: "SPV (Supervisor)" },
    { value: "whm", label: "WHM (Warehouse Manager)" },
    { value: "gm", label: "GM / Direktur (Final)" },
    { value: "purchasing_team", label: "Tim Purchasing (Setelah Approved)" },
  ],
  "purchasing.po": [
    { value: "check1", label: "Check PO (Level 1)" },
    { value: "director", label: "Approve Direktur" },
    { value: "warehouse", label: "Tim Gudang (Setelah Approved)" },
  ],
  "sales.so": [{ value: "warehouse", label: "Tim Gudang / SO Baru" }],
};

export default function ApprovalRulesPage() {
  const queryClient = useQueryClient();
  const [module, setModule] = useState("purchasing.po");
  const [stage, setStage] = useState("director");
  const [targetType, setTargetType] = useState("jabatan");
  const [targetValue, setTargetValue] = useState("");
  const [minAmount, setMinAmount] = useState("0");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["approval-rules"],
    queryFn: () => apiFetch<ApprovalRuleDto[]>("/notifications/rules"),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["company-positions"],
    queryFn: () => apiFetch<PositionOption[]>("/company/positions"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<ApprovalRuleDto>("/notifications/rules", {
        method: "POST",
        body: JSON.stringify({
          module,
          stage,
          target_type: targetType,
          target_value: targetType === "direct_supervisor" ? null : targetValue,
          min_amount: Number(minAmount) || 0,
          notify_in_app: true,
          notify_whatsapp: notifyWhatsapp,
          is_active: true,
        }),
      }),
    onSuccess: () => {
      toast.success("Aturan routing approval berhasil ditambahkan");
      setTargetValue("");
      queryClient.invalidateQueries({ queryKey: ["approval-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: ApprovalRuleDto) =>
      apiFetch<ApprovalRuleDto>(`/notifications/rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({
          module: rule.module,
          stage: rule.stage,
          target_type: rule.target_type,
          target_value: rule.target_value,
          branch_code: rule.branch_code,
          min_amount: rule.min_amount,
          max_amount: rule.max_amount,
          notify_in_app: rule.notify_in_app,
          notify_whatsapp: rule.notify_whatsapp,
          is_active: !rule.is_active,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/notifications/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Aturan dihapus");
      queryClient.invalidateQueries({ queryKey: ["approval-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      apiFetch("/notifications/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast.success("Notifikasi uji coba dikirim");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const positionName = (idStr: string | null) => {
    if (!idStr) return "-";
    const found = positions.find((p) => String(p.id_jabatan) === idStr);
    return found ? `${idStr} — ${found.jabatan}` : idStr;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Bell size={20} className="text-[#3a36db]" />
            Aturan Routing Notifikasi Approval
          </h1>
          <p className="text-xs text-[#788a9a]">
            Tentukan penerima notifikasi per modul &amp; tahap persetujuan (berdasarkan Atasan Langsung, Jabatan, Role, atau Username).
          </p>
        </div>

        <button
          type="button"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#3a36db] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2f2bc2] disabled:opacity-60"
        >
          <Send size={14} />
          Kirim Tes Notifikasi (SSE)
        </button>
      </div>

      {/* Add Rule Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#39394b]">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#788a9a]">
          Tambah Aturan Baru
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="block text-[11px] font-semibold mb-1">Modul</label>
            <select
              value={module}
              onChange={(e) => {
                const nextMod = e.target.value;
                setModule(nextMod);
                setStage(MODULE_STAGES[nextMod]?.[0]?.value || "");
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#222131]"
            >
              <option value="purchasing.pp">Purchasing — PP</option>
              <option value="purchasing.po">Purchasing — PO</option>
              <option value="sales.so">Sales — SO</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Tahap</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#222131]"
            >
              {(MODULE_STAGES[module] || []).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Tipe Penerima</label>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setTargetValue("");
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#222131]"
            >
              <option value="jabatan">Jabatan (master_jabatan)</option>
              <option value="role">Role (hakakses)</option>
              <option value="username">Username Spesifik</option>
              <option value="direct_supervisor">Atasan Langsung</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Target</label>
            {targetType === "jabatan" ? (
              <select
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#222131]"
              >
                <option value="">-- Pilih Jabatan --</option>
                {positions.map((p) => (
                  <option key={p.id_jabatan} value={String(p.id_jabatan)}>
                    {p.id_jabatan} - {p.jabatan}
                  </option>
                ))}
              </select>
            ) : targetType === "direct_supervisor" ? (
              <input
                disabled
                value="Otomatis dari pegawai.atasan_langsung"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-400 dark:border-white/10 dark:bg-[#222131]"
              />
            ) : (
              <input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === "role" ? "Contoh: ROLE_PO" : "Contoh: admin"}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#222131]"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Min Nominal (Rp)</label>
            <input
              type="number"
              min={0}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#222131]"
            />
          </div>

          <div className="flex flex-col justify-end gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={notifyWhatsapp}
                onChange={(e) => setNotifyWhatsapp(e.target.checked)}
              />
              Queue WhatsApp
            </label>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Plus size={14} /> Tambah Rule
            </button>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[#39394b]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 dark:border-white/10 dark:bg-[#222131] dark:text-[#a1a0b8]">
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">Tahap</th>
                <th className="px-4 py-3">Tipe Target</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3 text-right">Min Nominal</th>
                <th className="px-4 py-3 text-center">Kanal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Memuat aturan...
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-semibold text-[#3a36db] dark:text-[#8b88ff]">
                      {r.module}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.stage}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/10">
                        {r.target_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.target_type === "jabatan"
                        ? positionName(r.target_value)
                        : r.target_type === "direct_supervisor"
                        ? "Atasan Langsung"
                        : r.target_value || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.min_amount > 0 ? formatIDR(r.min_amount) : "Semua"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        In-App
                      </span>
                      {r.notify_whatsapp && (
                        <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          WA
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate(r)}
                        className={
                          r.is_active
                            ? "rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                            : "rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-400"
                        }
                      >
                        {r.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(r.id)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/20"
                        title="Hapus aturan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
