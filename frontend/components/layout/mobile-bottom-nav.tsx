"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  FileText,
  LayoutDashboard,
  ScanLine,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Order", href: "/sales/orders", icon: FileText },
  { label: "Scan", href: "/mobile/tools", icon: ScanLine, primary: true },
  { label: "Approval", href: "/purchasing/requests", icon: CheckSquare },
  { label: "Profil", href: "/profile", icon: User },
];

export function MobileBottomNav({ darkMode }: { darkMode: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden",
        darkMode
          ? "border-white/10 bg-[#39394b]/95 backdrop-blur"
          : "border-slate-200 bg-white/95 backdrop-blur"
      )}
    >
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        if (tab.primary) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center -mt-4"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3a36db] text-white shadow-lg shadow-[#3a36db]/30">
                <Icon size={22} />
              </span>
              <span
                className={cn(
                  "mt-0.5 text-[10px] font-semibold",
                  active
                    ? "text-[#3a36db] dark:text-[#8b88ff]"
                    : darkMode
                    ? "text-[#a1a0b8]"
                    : "text-[#788a9a]"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-w-[56px] flex-col items-center gap-0.5 py-1 text-[10px] font-semibold transition-colors",
              active
                ? "text-[#3a36db] dark:text-[#8b88ff]"
                : darkMode
                ? "text-[#a1a0b8]"
                : "text-[#788a9a]"
            )}
          >
            <Icon size={20} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
