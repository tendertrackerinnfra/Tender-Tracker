"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { Tender } from "@/lib/tender-types";
import { formatTenderDate } from "@/lib/tender-types";

type CalendarEvent = {
  id: string;
  title: string;
  authority: string;
  kind: "Last Date" | "Pre-bid" | "Open Date";
  date: string;
  tone: string;
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/tenders", { cache: "no-store" });
      const data = await response.json();
      const tenders = (data.tenders ?? []) as Tender[];
      setEvents(
        tenders
          .flatMap((tender) => [
            tender.lastDate ? { id: `${tender.id}-last`, title: tender.tenderName, authority: tender.authority, kind: "Last Date" as const, date: tender.lastDate, tone: "bg-red-50 text-red-700" } : null,
            tender.preBidDate ? { id: `${tender.id}-pre`, title: tender.tenderName, authority: tender.authority, kind: "Pre-bid" as const, date: tender.preBidDate, tone: "bg-amber-50 text-amber-700" } : null,
            tender.openDate ? { id: `${tender.id}-open`, title: tender.tenderName, authority: tender.authority, kind: "Open Date" as const, date: tender.openDate, tone: "bg-sky-50 text-sky-700" } : null
          ])
          .filter(Boolean)
          .sort((a, b) => String(a?.date).localeCompare(String(b?.date))) as CalendarEvent[]
      );
    })();
  }, []);

  return (
    <AppShell title="Calendar" kicker="Tender deadlines">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-semibold">Monthly deadline board</h2>
          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="rounded-xl bg-slate-50 px-2 py-3">{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => {
              const event = events[index];
              return (
                <div key={index} className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-semibold text-slate-500">{index + 1}</div>
                  {event ? (
                    <div className={`mt-2 rounded-xl px-2 py-1 text-[11px] font-semibold ${event.tone}`}>
                      {event.kind}
                      <div className="mt-1 line-clamp-2 font-medium text-slate-700">{event.title}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-semibold">Upcoming deadlines</h2>
          <div className="mt-4 space-y-3">
            {events.slice(0, 10).map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.tone}`}>{event.kind}</span>
                  <span className="text-xs font-medium text-slate-500">{formatTenderDate(event.date)}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{event.title}</p>
                <p className="mt-1 text-sm text-slate-600">{event.authority || "-"}</p>
              </div>
            ))}
            {events.length === 0 ? <p className="text-sm text-slate-500">No upcoming tender dates yet.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

