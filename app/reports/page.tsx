"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { BadgeIndianRupee, CalendarClock, Download, FileSpreadsheet, FolderKanban, TimerReset, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { Tender } from "@/lib/tender-types";
import { daysLeft, getTenderStatus } from "@/lib/tender-types";
import { moneyValue, toExportRow } from "@/components/tender-ui";

type ChartDatum = {
  label: string;
  value: number;
  tone: string;
};

export default function ReportsPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/tenders", { cache: "no-store" });
      const data = await response.json();
      setTenders(data.tenders ?? []);
    })();
  }, []);

  const report = useMemo(() => buildReportData(tenders), [tenders]);

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
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportRows("csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            <Download className="size-4" />
            Export CSV
          </button>
          <button onClick={() => exportRows("xlsx")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            <FileSpreadsheet className="size-4" />
            Export Excel
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Total active tenders" value={report.summary.active} note="Open, upcoming, urgent, and critical tenders." icon={FolderKanban} />
          <MetricCard label="Closed tenders" value={report.summary.closed} note="Submission deadlines already passed." icon={TimerReset} />
          <MetricCard label="Critical tenders" value={report.summary.critical} note="Closing in 0 to 2 days." icon={TriangleAlert} />
          <MetricCard label="Urgent tenders" value={report.summary.urgent} note="Closing in 3 to 7 days." icon={CalendarClock} />
          <MetricCard label="Closing this week" value={report.summary.thisWeek} note="Immediate follow-up opportunities." icon={CalendarClock} />
          <MetricCard label="Closing this month" value={report.summary.thisMonth} note="Current-month submission deadlines." icon={CalendarClock} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <MetricCard label="Total estimated tender value" value={formatCurrency(report.financial.totalEstimatedValue)} note="Combined estimated value across tracked tenders." icon={BadgeIndianRupee} />
          <MetricCard label="Total EMD amount" value={formatCurrency(report.financial.totalEmd)} note="Combined EMD requirement across tenders." icon={BadgeIndianRupee} />
          <MetricCard label="Average tender value" value={formatCurrency(report.financial.averageTenderValue)} note="Mean estimated value across all tenders." icon={BadgeIndianRupee} />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <ChartCard
            title="Status-wise tender count"
            description="Operational mix across active and closed opportunities."
            data={report.statusChart}
          />
          <ChartCard
            title="Department-wise tender count"
            description="Authorities with the highest current tender volume."
            data={report.departmentChart}
          />
          <ChartCard
            title="Portal-wise tender count"
            description="Tender distribution across procurement portals."
            data={report.portalChart}
          />
          <ChartCard
            title="Monthly closing tender count"
            description="Upcoming workload grouped by submission month."
            data={report.monthlyClosingChart}
          />
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon
}: {
  label: string;
  value: number | string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  data
}: {
  title: string;
  description: string;
  data: ChartDatum[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5 space-y-3">
        {data.length > 0 ? (
          data.map((item) => <BarRow key={item.label} datum={item} maxValue={Math.max(...data.map((entry) => entry.value), 1)} />)
        ) : (
          <p className="text-sm text-slate-500">No reporting data yet.</p>
        )}
      </div>
    </section>
  );
}

function BarRow({ datum, maxValue }: { datum: ChartDatum; maxValue: number }) {
  const width = `${Math.max((datum.value / maxValue) * 100, datum.value > 0 ? 8 : 0)}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-slate-700">{datum.label}</p>
        <span className="text-sm font-semibold text-slate-900">{datum.value}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${datum.tone}`} style={{ width }} />
      </div>
    </div>
  );
}

function buildReportData(tenders: Tender[]) {
  const today = new Date();
  const totalEstimatedValue = tenders.reduce((sum, tender) => sum + moneyValue(tender.estimatedCost), 0);
  const totalEmd = tenders.reduce((sum, tender) => sum + moneyValue(tender.emd), 0);

  const summary = {
    active: tenders.filter((tender) => getTenderStatus(tender.lastDate) !== "Closed").length,
    closed: tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Closed").length,
    critical: tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Critical").length,
    urgent: tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Urgent").length,
    thisWeek: tenders.filter((tender) => {
      const left = daysLeft(tender.lastDate);
      return left !== null && left >= 0 && left <= 7;
    }).length,
    thisMonth: tenders.filter((tender) => isSameMonth(tender.lastDate, today)).length
  };

  const financial = {
    totalEstimatedValue,
    totalEmd,
    averageTenderValue: tenders.length > 0 ? totalEstimatedValue / tenders.length : 0
  };

  return {
    summary,
    financial,
    statusChart: buildCountChart(
      ["Critical", "Urgent", "Upcoming", "Active", "Closed"].map((status) => [
        status,
        tenders.filter((tender) => getTenderStatus(tender.lastDate) === status).length
      ]),
      {
        Critical: "bg-red-500",
        Urgent: "bg-amber-500",
        Upcoming: "bg-blue-500",
        Active: "bg-emerald-600",
        Closed: "bg-slate-400"
      }
    ),
    departmentChart: buildCountChart(
      topCounts(tenders, (tender) => tender.authority || "Unknown"),
      "bg-emerald-600"
    ),
    portalChart: buildCountChart(
      topCounts(tenders, (tender) => tender.portalName || "Unspecified"),
      "bg-blue-500"
    ),
    monthlyClosingChart: buildCountChart(
      topCounts(
        tenders.filter((tender) => tender.lastDate),
        (tender) => monthLabel(tender.lastDate || "")
      ),
      "bg-amber-500",
      12
    )
  };
}

function topCounts(
  tenders: Tender[],
  selector: (tender: Tender) => string,
  limit = 6
): Array<[string, number]> {
  return Array.from(
    tenders.reduce((map, tender) => {
      const key = selector(tender);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function buildCountChart(
  entries: Array<[string, number]>,
  tones: string | Record<string, string>,
  limit?: number
): ChartDatum[] {
  return entries
    .filter(([, value]) => value > 0)
    .slice(0, limit ?? entries.length)
    .map(([label, value]) => ({
      label,
      value,
      tone: typeof tones === "string" ? tones : tones[label] ?? "bg-emerald-600"
    }));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function isSameMonth(value: string, today: Date) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function monthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", { month: "short", year: "numeric" });
}
