"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { useNotificationCenter } from "@/components/notification-client";

export function TopBar({
  title,
  kicker,
  actions
}: {
  title: string;
  kicker: string;
  actions?: ReactNode;
}) {
  const { unreadCount } = useNotificationCenter();
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short"
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-col gap-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">INNFRA CONSOL</p>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">Tender Tracker</h1>
                <span className="hidden text-sm text-slate-300 sm:inline">/</span>
                <p className="hidden text-sm font-medium text-slate-600 sm:inline">{title}</p>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{kicker}</p>
              <p className="text-xs text-slate-500">{today}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,101,52,0.2)]"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Tender</span>
            </Link>
          </div>
        </div>

        {actions ? <div className="mt-3 border-t border-slate-100 pt-3">{actions}</div> : null}
      </div>
    </header>
  );
}
