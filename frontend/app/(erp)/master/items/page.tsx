"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { ItemDto, PaginatedResponse } from "@/types";
import { ErpTable } from "@/components/data-table/erp-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

export default function MasterItemsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    id_barang: "",
    nama_barang: "",
    id_kategori_barang: "01",
    id_satuan_besar: "DRM",
    id_satuan_kecil: "LTR",
    isi_satuan: 209,
    keterangan: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["master-items", page, q],
    queryFn: () =>
      apiFetch<PaginatedResponse<ItemDto>>("/master/items", {}, {
        page,
        per_page: 25,
        q,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<ItemDto>("/master/items", {
        method: "POST",
        body: JSON.stringify({ ...form, status: true }),
      }),
    onSuccess: () => {
      toast.success("Barang berhasil ditambahkan");
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ["master-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <ErpTable
        title="Master Barang"
        subtitle="Daftar produk pelumas, bahan bakar, dan suku cadang"
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
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={15} /> Tambah Barang
          </button>
        }
        columns={[
          {
            header: "Kode Barang",
            accessor: (r) => (
              <span className="font-mono font-semibold text-indigo-700">
                {r.id_barang}
              </span>
            ),
          },
          {
            header: "Nama Barang",
            accessor: (r) => (
              <div>
                <div className="font-medium text-slate-900">{r.nama_barang}</div>
                {r.nama_alias && (
                  <div className="text-xs text-slate-400">{r.nama_alias}</div>
                )}
              </div>
            ),
          },
          {
            header: "Kategori",
            accessor: (r) => r.kategori_barang || r.id_kategori_barang,
          },
          {
            header: "Kemasan / Isi",
            accessor: (r) =>
              `${r.satuan_besar || r.id_satuan_besar} (${formatNumber(
                r.isi_satuan
              )} ${r.satuan_kecil || r.id_satuan_kecil})`,
          },
          {
            header: "Brand / Family",
            accessor: (r) => r.brand || r.family || "-",
          },
          {
            header: "Status",
            accessor: (r) => (
              <StatusBadge status={r.status ? "Aktif" : "Nonaktif"} />
            ),
          },
        ]}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Tambah Master Barang
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Kode Barang
                </label>
                <input
                  value={form.id_barang}
                  onChange={(e) =>
                    setForm({ ...form, id_barang: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Kategori (mis. 01)
                </label>
                <input
                  value={form.id_kategori_barang}
                  onChange={(e) =>
                    setForm({ ...form, id_kategori_barang: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600">
                  Nama Barang
                </label>
                <input
                  value={form.nama_barang}
                  onChange={(e) =>
                    setForm({ ...form, nama_barang: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Satuan Besar
                </label>
                <input
                  value={form.id_satuan_besar}
                  onChange={(e) =>
                    setForm({ ...form, id_satuan_besar: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Satuan Kecil
                </label>
                <input
                  value={form.id_satuan_kecil}
                  onChange={(e) =>
                    setForm({ ...form, id_satuan_kecil: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Isi Satuan
                </label>
                <input
                  type="number"
                  value={form.isi_satuan}
                  onChange={(e) =>
                    setForm({ ...form, isi_satuan: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Batal
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Simpan Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
