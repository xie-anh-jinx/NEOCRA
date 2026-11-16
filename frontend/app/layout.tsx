import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/hooks/use-auth";

export const metadata: Metadata = {
  title: "NEOCRA ERP — PT. Cahaya Resource Abadi",
  description: "Corporate Resource Application (NEOCRA v1) — Rust Axum & Next.js ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
