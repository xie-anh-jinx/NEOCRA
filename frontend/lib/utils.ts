import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function stripHtmlToText(
  value: string | null | undefined,
  singleLine = false
): string {
  if (!value) return "-";

  const withLineBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n");

  const withoutTags = withLineBreaks.replace(/<[^>]*>/g, "");

  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  const lines = decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  if (singleLine) {
    const joined = lines.filter(Boolean).join(" · ");
    return joined || "-";
  }

  const cleaned = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || "-";
}
