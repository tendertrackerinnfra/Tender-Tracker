"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

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
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf5ef_0%,#f8fafc_16%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={title} kicker={kicker} actions={actions} />
          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}
