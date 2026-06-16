"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { Tender } from "@/lib/tender-types";
import { getTenderStatus } from "@/lib/tender-types";
import { moneyValue, toExportRow } from "@/components/tender-ui";

export default function ReportsPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/tenders", { cache: "no-store" });
      const data = await response.json();
      setTenders(data.tenders ?? []);
    })();
  }, []);

  const active = tenders.filter((tender) => getTenderStatus(tender.lastDate) !== "Closed");
  const closed = tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Closed");
  const totalValue = tenders.reduce((sum, tender) => sum + moneyValue(tender.estimatedCost), 0);
  const byAuthority = Array.from(
    tenders.reduce((map, tender) => {
      const key = tender.authority || "Unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  );

  function exportRows(format: "csv" | "xlsx") {
    const rows = tenders.map(toExportRow);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tenders");
    XLSX.writeFile(workbook, `tender-tracker-reports.${format}`, { bookType: format === "csv" ? "csv" : "xlsx" });
  }

  return (
    <AppShell
      title="Reports"
      kicker="Tender analytics"
      actions={
        <>
          <button onClick={() => exportRows("csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            <Download className="size-4" />
            CSV
          </button>
          <button onClick={() => exportRows("xlsx")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            <FileSpreadsheet className="size-4" />
            Excel
          </button>
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="grid gap-4 md:grid-cols-2">
          <ReportMetric label="Active tenders" value={active.length} note="Open and upcoming work packages" />
          <ReportMetric label="Closed tenders" value={closed.length} note="Submission windows already ended" />
          <ReportMetric label="Department count" value={byAuthority.length} note="Authorities represented in the tracker" />
          <ReportMetric label="Tender value summary" value={new Intl.NumberFormat("en-IN").format(totalValue)} note="Combined estimated value across all tenders" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-semibold">Department-wise tender count</h2>
          <div className="mt-4 space-y-3">
            {byAuthority.map(([authority, count]) => (
              <div key={authority} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{authority}</p>
                  <p className="text-xs text-slate-500">Tracked tenders from this authority</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">{count}</div>
              </div>
            ))}
            {byAuthority.length === 0 ? <p className="text-sm text-slate-500">No reporting data yet.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ReportMetric({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

