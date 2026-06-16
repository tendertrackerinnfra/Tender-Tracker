"use client";

import { CalendarDays, Home, Upload } from "lucide-react";
import Link from "next/link";

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
        <Link href="/" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md bg-slate-950 px-2 text-[11px] font-bold text-white">
          <Home className="size-5" />
          <span>Dashboard</span>
        </Link>
        <Link href="/upload" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-[11px] font-bold text-slate-600">
          <Upload className="size-5" />
          <span>Upload</span>
        </Link>
        <Link href="/calendar" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-[11px] font-bold text-slate-600">
          <CalendarDays className="size-5" />
          <span>Calendar</span>
        </Link>
      </div>
    </nav>
  );
}
