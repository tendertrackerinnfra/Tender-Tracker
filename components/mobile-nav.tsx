"use client";

import { CalendarDays, FileBarChart2, Home, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/upload", label: "Upload", icon: Plus },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/reports", label: "Reports", icon: FileBarChart2 },
    { href: "/settings", label: "Settings", icon: Settings }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-bold ${
                active ? "bg-slate-950 text-white" : "text-slate-600"
              }`}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
