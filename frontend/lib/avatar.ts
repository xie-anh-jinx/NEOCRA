import { apiFetch } from "@/services/api";

export async function resizeImageToDataUrl(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("File bukan gambar yang valid"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas tidak tersedia"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadUserAvatar(file: File): Promise<string | null> {
  const dataUrl = await resizeImageToDataUrl(file);
  const res = await apiFetch<{ avatar_url: string | null }>("/auth/avatar", {
    method: "POST",
    body: JSON.stringify({ avatar_data: dataUrl }),
  });
  return res.avatar_url;
}

export async function removeUserAvatar(): Promise<void> {
  await apiFetch("/auth/avatar", { method: "DELETE" });
}
