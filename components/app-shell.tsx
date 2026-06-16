"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  Plus,
  Settings
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Tender", icon: Plus },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({
  title,
  kicker,
  actions,
  children
}: {
  title: string;
  kicker: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const today = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short"
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef4ef_0%,#f8fafc_24%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200/80 bg-white/85 px-5 py-6 backdrop-blur xl:flex xl:flex-col">
          <div className="rounded-2xl bg-[radial-gradient(circle_at_top,#14532d_0%,#0f172a_72%)] p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">INNFRA CONSOL</p>
            <h1 className="mt-2 text-2xl font-semibold">Tender Tracker</h1>
            <p className="mt-2 text-sm text-slate-200">Civil consultancy tender follow-up, deadlines, extraction, and reporting.</p>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    active ? "bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-emerald-700" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Daily follow-up</p>
                <p className="text-xs text-slate-500">Check critical deadlines and pre-bid actions first.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{kicker}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 md:block">
                    {today}
                  </div>
                  <button className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600">
                    <Bell className="size-4" />
                  </button>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    INNFRA CONSOL
                  </div>
                  {actions}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

