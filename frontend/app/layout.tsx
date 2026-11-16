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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
