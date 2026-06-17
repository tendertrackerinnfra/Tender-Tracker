"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  Plus,
  Settings
} from "lucide-react";

const sidebarItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Tender", icon: Plus },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200/80 bg-white xl:flex xl:flex-col">
      <div className="flex h-full flex-col px-5 py-6">
        <div className="rounded-2xl border border-emerald-950/10 bg-[radial-gradient(circle_at_top_left,#166534_0%,#0f172a_78%)] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">INNFRA CONSOL</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Tender Tracker</h1>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Daily tender follow-up for deadlines, submissions, document readiness, and reporting.
          </p>
        </div>

        <nav className="mt-6 space-y-1.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-emerald-700" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Tender follow-up queue</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Prioritize critical last dates, then pre-bid actions and missing documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
