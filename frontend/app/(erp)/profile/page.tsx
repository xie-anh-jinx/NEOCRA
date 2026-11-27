"use client";

import React, { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/services/api";
import { uploadUserAvatar, removeUserAvatar } from "@/lib/avatar";
import { toast } from "sonner";
import { Camera, Lock, Trash2, User } from "lucide-react";

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadUserAvatar(file);
      await refreshProfile();
      toast.success("Foto profil berhasil diperbarui");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengupload foto");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      await removeUserAvatar();
      await refreshProfile();
      toast.success("Foto profil dihapus");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus foto");
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      toast.success("Password berhasil diperbarui");
      setOldPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah password");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-xs dark:bg-[#39394b]">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.nama}
                className="h-24 w-24 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#3a36db]/10 text-[#3a36db] dark:bg-[#605cff]/20 dark:text-[#8b88ff]">
                <User size={40} />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex-1 space-y-1">
            <h1 className="text-xl font-bold text-[#06152b] dark:text-white">{user.nama}</h1>
            <p className="text-sm text-[#788a9a] dark:text-[#a1a0b8]">
              {user.jabatan || "Karyawan"} · {user.departemen || "-"}
            </p>
            <p className="text-xs font-mono text-[#788a9a] dark:text-[#a1a0b8]">
              @{user.username} · ID Pegawai: {user.id_pegawai}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#3a36db] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2f2bc2] disabled:opacity-50"
              >
                <Camera size={14} />
                {uploading ? "Mengupload..." : "Upload Foto Profil"}
              </button>
              {user.avatar_url && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Hapus Foto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-xs dark:bg-[#39394b] space-y-3">
          <h2 className="text-sm font-bold text-[#06152b] dark:text-white">Data Pribadi &amp; Penempatan</h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-100 dark:border-white/10 py-1.5">
              <span className="text-[#788a9a] dark:text-[#a1a0b8]">Kantor Cabang</span>
              <span className="font-semibold text-[#06152b] dark:text-white">{user.kantor || "-"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 dark:border-white/10 py-1.5">
              <span className="text-[#788a9a] dark:text-[#a1a0b8]">Akses Cabang</span>
              <span className="font-semibold text-[#06152b] dark:text-white">{user.branches.length} Cabang</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 dark:border-white/10 py-1.5">
              <span className="text-[#788a9a] dark:text-[#a1a0b8]">Akses Gudang</span>
              <span className="font-semibold text-[#06152b] dark:text-white">{user.warehouses.length} Gudang</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#788a9a] dark:text-[#a1a0b8]">Total Role</span>
              <span className="font-semibold text-[#06152b] dark:text-white">
                {user.is_superadmin ? "Superadmin" : `${user.roles.length} Roles`}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="rounded-2xl bg-white p-6 shadow-xs dark:bg-[#39394b] space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#3a36db] dark:text-[#8b88ff]" />
            <h2 className="text-sm font-bold text-[#06152b] dark:text-white">Ubah Password</h2>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#06152b] dark:text-white">
              Password Lama
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full rounded-xl bg-[#f1f4fa] px-3.5 py-2.5 text-xs text-[#06152b] dark:bg-[#222131] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3a36db]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#06152b] dark:text-white">
              Password Baru (min. 6 karakter)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-[#f1f4fa] px-3.5 py-2.5 text-xs text-[#06152b] dark:bg-[#222131] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3a36db]"
            />
          </div>
          <button
            type="submit"
            disabled={savingPw}
            className="w-full rounded-xl bg-[#3a36db] py-2.5 text-xs font-semibold text-white hover:bg-[#2f2bc2] disabled:opacity-50"
          >
            {savingPw ? "Menyimpan..." : "Simpan Password Baru"}
          </button>
        </form>
      </div>
    </div>
  );
}
