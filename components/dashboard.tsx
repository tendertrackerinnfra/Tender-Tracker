"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  BadgeIndianRupee,
  CalendarClock,
  Check,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  MoreHorizontal,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { ScheduledNotification, Tender, TenderInput } from "@/lib/tender-types";
import { daysLeft, formatTenderDate, getTenderStatus, normalizeTenderInput } from "@/lib/tender-types";
import {
  formFields,
  fromInputDate,
  moneyValue,
  requiredPreviewFields,
  statusStyles,
  type StatusFilter,
  toExportRow,
  toInputDate,
  valueOf
} from "@/components/tender-ui";

type DashboardState = {
  isLoading: boolean;
  isSaving: boolean;
  message: string;
  search: string;
  statusFilter: StatusFilter;
  portalFilter: string;
  dateFrom: string;
  dateTo: string;
};

export function Dashboard() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [state, setState] = useState<DashboardState>({
    isLoading: true,
    isSaving: false,
    message: "",
    search: "",
    statusFilter: "All",
    portalFilter: "All",
    dateFrom: "",
    dateTo: ""
  });
  const [viewTender, setViewTender] = useState<Tender | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTender, setEditTender] = useState<TenderInput | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadTenders();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const portals = ["All", ...Array.from(new Set(tenders.map((tender) => tender.portalName).filter(Boolean))).sort()];
  const filteredTenders = tenders.filter((tender) => {
    const query = state.search.trim().toLowerCase();
    const status = getTenderStatus(tender.lastDate);
    const lastDate = tender.lastDate ? new Date(tender.lastDate) : null;
    const matchesSearch =
      !query ||
      [tender.tenderName, tender.tenderId, tender.authority].some((value) => value?.toLowerCase().includes(query));
    const matchesStatus = state.statusFilter === "All" || status === state.statusFilter;
    const matchesPortal = state.portalFilter === "All" || tender.portalName === state.portalFilter;
    const matchesDateFrom = !state.dateFrom || (lastDate && lastDate >= new Date(`${state.dateFrom}T00:00:00`));
    const matchesDateTo = !state.dateTo || (lastDate && lastDate <= new Date(`${state.dateTo}T23:59:59`));
    return matchesSearch && matchesStatus && matchesPortal && matchesDateFrom && matchesDateTo;
  });
  const sortedTenders = [...filteredTenders].sort((a, b) => compareTenderDates(a.lastDate, b.lastDate));

  const alerts = {
    today: sortedTenders.filter((tender) => daysLeft(tender.lastDate) === 0),
    tomorrow: sortedTenders.filter((tender) => daysLeft(tender.lastDate) === 1),
    week: sortedTenders.filter((tender) => {
      const left = daysLeft(tender.lastDate);
      return left !== null && left >= 0 && left <= 7;
    }),
    preBid: sortedTenders.filter((tender) => {
      const left = daysLeft(tender.preBidDate);
      return left !== null && left >= 0 && left <= 7;
    }),
    incomplete: sortedTenders.filter((tender) => !tender.tenderName || !tender.authority || !tender.lastDate || !tender.documentsRequired)
  };
  const nextDeadline =
    sortedTenders
      .filter((tender) => {
        const left = daysLeft(tender.lastDate);
        return left !== null && left >= 0;
      })
      .sort((a, b) => {
        const aLeft = daysLeft(a.lastDate) ?? Number.MAX_SAFE_INTEGER;
        const bLeft = daysLeft(b.lastDate) ?? Number.MAX_SAFE_INTEGER;
        return aLeft - bLeft;
      })[0] ?? null;

  const summary = [
    {
      label: "Total Active Tenders",
      value: tenders.filter((tender) => getTenderStatus(tender.lastDate) !== "Closed").length,
      note: "Open and upcoming opportunities",
      accent: "border-l-4 border-l-emerald-600",
      icon: CalendarClock
    },
    {
      label: "Critical",
      value: tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Critical").length,
      note: "Last date in 0 to 2 days",
      accent: "border-l-4 border-l-red-500",
      icon: TriangleAlert
    },
    {
      label: "Urgent",
      value: tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Urgent").length,
      note: "Last date in 3 to 7 days",
      accent: "border-l-4 border-l-amber-500",
      icon: AlertTriangle
    },
    {
      label: "Closing This Week",
      value: tenders.filter((tender) => {
        const left = daysLeft(tender.lastDate);
        return left !== null && left >= 0 && left <= 7;
      }).length,
      note: "Track immediate follow-up",
      accent: "border-l-4 border-l-sky-500",
      icon: CalendarClock
    },
    {
      label: "Closed",
      value: tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Closed").length,
      note: "Past submission deadlines",
      accent: "border-l-4 border-l-slate-400",
      icon: Check
    },
    {
      label: "Total Estimated Value",
      value: formatMoney(tenders.reduce((sum, tender) => sum + moneyValue(tender.estimatedCost), 0)),
      note: "Combined value of listed tenders",
      accent: "border-l-4 border-l-emerald-700",
      icon: BadgeIndianRupee
    }
  ];

  async function loadTenders() {
    setState((current) => ({ ...current, isLoading: true }));
    const response = await fetch("/api/tenders", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setTenders(data.tenders);
      setState((current) => ({ ...current, isLoading: false }));
    } else {
      setState((current) => ({ ...current, isLoading: false, message: data.error ?? "Unable to load tenders." }));
    }
  }

  async function deleteTender(id: string) {
    const response = await fetch(`/api/tenders/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setState((current) => ({ ...current, message: data.error ?? "Unable to delete tender." }));
      return;
    }
    setTenders((items) => items.filter((tender) => tender.id !== id));
    setState((current) => ({ ...current, message: "Tender deleted and related reminders removed." }));
  }

  async function saveEdit() {
    if (!editId || !editTender) return;
    setState((current) => ({ ...current, isSaving: true, message: "" }));
    try {
      const response = await fetch(`/api/tenders/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editTender)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update tender.");
      scheduleBrowserNotifications(data.notifications ?? []);
      await loadTenders();
      setEditId(null);
      setEditTender(null);
      setState((current) => ({ ...current, message: "Tender updated and reminders rescheduled." }));
    } catch (error) {
      setState((current) => ({ ...current, message: (error as Error).message }));
    } finally {
      setState((current) => ({ ...current, isSaving: false }));
    }
  }

  function startEdit(tender: Tender) {
    setEditId(tender.id);
    setEditTender(normalizeTenderInput(tender));
  }

  function exportRows(format: "csv" | "xlsx") {
    const rows = filteredTenders.map(toExportRow);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tenders");
    XLSX.writeFile(workbook, `tender-tracker.${format}`, { bookType: format === "csv" ? "csv" : "xlsx" });
  }

  async function importSpreadsheet(file: File) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    let imported = 0;
    for (const row of rows) {
      const tender = normalizeTenderInput({
        tenderName: valueOf(row, "Tender Name"),
        authority: valueOf(row, "Authority"),
        tenderId: valueOf(row, "Tender ID"),
        lastDate: valueOf(row, "Last Date"),
        preBidDate: valueOf(row, "Pre-bid Date"),
        openDate: valueOf(row, "Open Date"),
        emd: valueOf(row, "EMD"),
        tenderFee: valueOf(row, "Tender Fee"),
        estimatedCost: valueOf(row, "Estimated Cost"),
        bidValidity: valueOf(row, "Bid Validity"),
        workCompletionPeriod: valueOf(row, "Work Completion Period"),
        portalName: valueOf(row, "Portal Name"),
        documentsRequired: valueOf(row, "Documents Required")
      });
      if (!tender.tenderName || !tender.authority || !tender.lastDate) continue;
      const response = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tender)
      });
      if (response.ok) imported += 1;
    }
    await loadTenders();
    setState((current) => ({ ...current, message: `Imported ${imported} tender${imported === 1 ? "" : "s"}.` }));
  }

  return (
    <AppShell
      title="Dashboard"
      kicker="Tender follow-up"
      actions={
        <>
          <div className="hidden min-w-64 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search className="size-4 text-slate-400" />
            <input
              value={state.search}
              onChange={(event) => setState((current) => ({ ...current, search: event.target.value }))}
              placeholder="Quick search by tender, ID, authority"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSpreadsheet(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => {
                setShowMobileActions(false);
                setShowMobileFilters((current) => !current);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <Filter className="size-4" />
              Filters
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowMobileFilters(false);
                  setShowMobileActions((current) => !current);
                }}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white p-2 text-slate-700"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {showMobileActions ? (
                <div className="absolute right-0 top-12 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                  <button
                    onClick={() => {
                      setShowMobileActions(false);
                      importInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="size-4" />
                    Import
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileActions(false);
                      exportRows("csv");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="size-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileActions(false);
                      exportRows("xlsx");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="size-4" />
                    Export Excel
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(21,128,61,0.18)]">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Tender</span>
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {state.message ? <Banner message={state.message} /> : null}

        <section className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {summary.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ${item.accent}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
              </div>
            );
          })}
        </section>

        <section className="space-y-3 sm:hidden">
          <div className="grid grid-cols-2 gap-3">
            {summary.slice(0, 4).map((item) => (
              <CompactMetricCard key={item.label} label={item.label} value={item.value} note={item.note} />
            ))}
          </div>

          <NextDeadlineCard tender={nextDeadline} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Important Alerts</h2>
                <p className="text-xs text-slate-500">Counts only for quick follow-up.</p>
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                View
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CompactAlertCount label="Closing today" count={alerts.today.length} tone="Critical" />
              <CompactAlertCount label="Tomorrow" count={alerts.tomorrow.length} tone="Urgent" />
              <CompactAlertCount label="Within 7 days" count={alerts.week.length} tone="Upcoming" />
              <CompactAlertCount label="Incomplete" count={alerts.incomplete.length} tone="Closed" />
            </div>
          </div>
        </section>

        <section className="hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:block">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-amber-700" />
              <h2 className="text-base font-semibold">Important Tender Alerts</h2>
            </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
            <AlertCard title="Tenders closing today" tone="Critical" tenders={alerts.today} />
            <AlertCard title="Tenders closing tomorrow" tone="Urgent" tenders={alerts.tomorrow} />
            <AlertCard title="Closing within 7 days" tone="Upcoming" tenders={alerts.week} />
            <AlertCard title="Upcoming pre-bid meetings" tone="Upcoming" tenders={alerts.preBid} />
            <AlertCard title="Missing required information" tone="Closed" tenders={alerts.incomplete} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">Tender Dashboard Table</h2>
                <p className="text-sm text-slate-600">
                  Sorted by last date for daily tender review, deadline tracking, and quick actions.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[220px_150px_160px_150px_150px]">
                <label className="relative sm:hidden">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                  <input
                    value={state.search}
                    onChange={(event) => setState((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search tender, ID, authority"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600"
                  />
                </label>
                <div className={`${showMobileFilters ? "grid" : "hidden"} gap-2 sm:contents`}>
                  <select value={state.statusFilter} onChange={(event) => setState((current) => ({ ...current, statusFilter: event.target.value as StatusFilter }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none">
                    {(["All", "Critical", "Urgent", "Upcoming", "Active", "Closed"] as StatusFilter[]).map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <select value={state.portalFilter} onChange={(event) => setState((current) => ({ ...current, portalFilter: event.target.value }))} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none">
                    {portals.map((portal) => (
                      <option key={portal}>{portal}</option>
                    ))}
                  </select>
                  <input value={state.dateFrom} onChange={(event) => setState((current) => ({ ...current, dateFrom: event.target.value }))} type="date" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none" />
                  <input value={state.dateTo} onChange={(event) => setState((current) => ({ ...current, dateTo: event.target.value }))} type="date" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none" />
                </div>
                <div className="hidden gap-2 sm:flex">
                  <button onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">
                    <FileSpreadsheet className="size-4" />
                    Import
                  </button>
                  <button onClick={() => exportRows("csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">
                    <Download className="size-4" />
                    CSV
                  </button>
                  <button onClick={() => exportRows("xlsx")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">
                    <Download className="size-4" />
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showMobileFilters ? (
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 sm:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Filters</p>
              <p className="mt-1 text-xs text-slate-500">Status, portal, and last-date range.</p>
            </div>
          ) : null}

          {state.isLoading ? <DashboardSkeleton /> : null}

          {!state.isLoading && sortedTenders.length === 0 ? (
            <EmptyState />
          ) : null}

          {!state.isLoading && sortedTenders.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1380px] divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-wide text-slate-600 backdrop-blur">
                    <tr>
                      <th className="px-4 py-3">Tender Name</th>
                      <th className="px-4 py-3">Authority</th>
                      <th className="px-4 py-3">Tender ID</th>
                      <th className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          Last Date
                          <ChevronDown className="size-3 text-slate-400" />
                        </span>
                      </th>
                      <th className="px-4 py-3">Pre-bid Date</th>
                      <th className="px-4 py-3">Open Date</th>
                      <th className="px-4 py-3">Days Left</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">EMD</th>
                      <th className="px-4 py-3">Tender Fee</th>
                      <th className="px-4 py-3">Estimated Cost</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedTenders.map((tender) => (
                      <DesktopTenderRow
                        key={tender.id}
                        tender={tender}
                        onView={() => setViewTender(tender)}
                        onEdit={() => startEdit(tender)}
                        onDelete={() => void deleteTender(tender.id)}
                        menuOpen={openActionMenuId === tender.id}
                        onToggleMenu={() => setOpenActionMenuId((current) => (current === tender.id ? null : tender.id))}
                        onCloseMenu={() => setOpenActionMenuId(null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 lg:hidden">
                {sortedTenders.map((tender) => (
                  <MobileTenderCard
                    key={tender.id}
                    tender={tender}
                    onView={() => setViewTender(tender)}
                    onEdit={() => startEdit(tender)}
                    onDelete={() => void deleteTender(tender.id)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      {viewTender ? (
        <TenderDetails
          tender={viewTender}
          onClose={() => setViewTender(null)}
          onEdit={() => {
            setViewTender(null);
            startEdit(viewTender);
          }}
          onDelete={async () => {
            await deleteTender(viewTender.id);
            setViewTender(null);
          }}
        />
      ) : null}
      {editTender ? (
        <EditTenderModal
          tender={editTender}
          isSaving={state.isSaving}
          onClose={() => {
            setEditTender(null);
            setEditId(null);
          }}
          onSave={() => void saveEdit()}
          onChange={setEditTender}
        />
      ) : null}
    </AppShell>
  );
}

function Banner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      {message}
    </div>
  );
}

function AlertCard({ title, tone, tenders }: { title: string; tone: keyof typeof statusStyles; tenders: Tender[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyles[tone]}`}>{tone}</span>
      </div>
      <div className="mt-3 space-y-3">
        {tenders.slice(0, 4).map((tender) => (
          <div key={tender.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{tender.tenderName || tender.tenderId || "Tender"}</p>
            <p className="mt-1 text-xs text-slate-500">{formatTenderDate(title.includes("pre-bid") ? tender.preBidDate : tender.lastDate)}</p>
          </div>
        ))}
        {tenders.length === 0 ? <p className="text-xs text-slate-500">No matching alerts.</p> : null}
      </div>
    </div>
  );
}

function CompactMetricCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="flex min-h-[82px] flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="max-w-[84px] text-right text-[11px] leading-4 text-slate-400">{note}</p>
      </div>
    </div>
  );
}

function NextDeadlineCard({ tender }: { tender: Tender | null }) {
  if (!tender) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-semibold text-slate-900">Next Deadline</p>
        <p className="mt-2 text-sm text-slate-500">No upcoming submission deadlines.</p>
      </div>
    );
  }

  const status = getTenderStatus(tender.lastDate);
  const left = daysLeft(tender.lastDate);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Next Deadline</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-700">{tender.tenderName || "-"}</p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyles[status]}`}>{status}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Last Date</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{formatTenderDate(tender.lastDate)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Days Left</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{left === null ? "-" : left < 0 ? "Past" : left}</p>
        </div>
      </div>
    </div>
  );
}

function CompactAlertCount({
  label,
  count,
  tone
}: {
  label: string;
  count: number;
  tone: keyof typeof statusStyles;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusStyles[tone]}`}>{count}</span>
      </div>
    </div>
  );
}

function DesktopTenderRow({
  tender,
  onView,
  onEdit,
  onDelete,
  menuOpen,
  onToggleMenu,
  onCloseMenu
}: {
  tender: Tender;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  const status = getTenderStatus(tender.lastDate);
  const left = daysLeft(tender.lastDate);
  return (
    <tr className="align-top transition hover:bg-emerald-50/40">
      <td className="max-w-xs px-4 py-4 font-medium text-slate-950">
        <div className="line-clamp-2 leading-6">{tender.tenderName || "-"}</div>
      </td>
      <td className="max-w-[240px] px-4 py-4 text-slate-700">
        <div className="line-clamp-2 leading-6">{tender.authority || "-"}</div>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-slate-700">{tender.tenderId || "-"}</td>
      <td className="px-4 py-4 font-medium text-slate-800">{formatTenderDate(tender.lastDate)}</td>
      <td className="px-4 py-4 text-slate-700">{formatTenderDate(tender.preBidDate)}</td>
      <td className="px-4 py-4 text-slate-700">{formatTenderDate(tender.openDate)}</td>
      <td className="px-4 py-4 font-semibold text-slate-900">{left === null ? "-" : left < 0 ? "Past" : left}</td>
      <td className="px-4 py-4">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status]}`}>{status}</span>
      </td>
      <td className="px-4 py-4 text-slate-700">{tender.emd || "-"}</td>
      <td className="px-4 py-4 text-slate-700">{tender.tenderFee || "-"}</td>
      <td className="px-4 py-4 text-slate-700">{tender.estimatedCost || "-"}</td>
      <td className="px-4 py-4">
        <div className="relative flex justify-end">
          <button
            onClick={onToggleMenu}
            aria-label="Tender actions"
            className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 shadow-sm"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-11 z-20 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <MenuAction
                label="View"
                icon={<Eye className="size-4" />}
                onClick={() => {
                  onCloseMenu();
                  onView();
                }}
              />
              <MenuAction
                label="Edit"
                icon={<Pencil className="size-4" />}
                onClick={() => {
                  onCloseMenu();
                  onEdit();
                }}
              />
              <MenuAction
                label="Delete"
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  onCloseMenu();
                  onDelete();
                }}
                danger
              />
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function MenuAction({
  label,
  icon,
  onClick,
  danger = false
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
        danger ? "text-red-700 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileTenderCard({
  tender,
  onView,
  onEdit,
  onDelete
}: {
  tender: Tender;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getTenderStatus(tender.lastDate);
  const left = daysLeft(tender.lastDate);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">{tender.tenderName || "-"}</p>
          <p className="mt-1 line-clamp-1 text-sm text-slate-600">{tender.authority || "-"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyles[status]}`}>{status}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {left === null ? "-" : left < 0 ? "Past" : `${left}d`}
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <InfoLine label="Last Date" value={formatTenderDate(tender.lastDate)} />
        <InfoLine label="Tender ID" value={tender.tenderId || "-"} />
        <InfoLine label="EMD" value={tender.emd || "-"} />
        <InfoLine label="Estimated Cost" value={tender.estimatedCost || "-"} />
      </div>
      <div className="mt-4 flex gap-2">
        <ActionPill onClick={onView} label="View" />
        <ActionPill onClick={onEdit} label="Edit" />
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ActionPill({ onClick, label, danger = false }: { onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-xl px-3 py-2 text-sm font-semibold ${danger ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
      {label}
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="rounded-full bg-emerald-100 p-4 text-emerald-800">
        <CalendarClock className="size-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">No tenders available</h3>
        <p className="mt-1 text-sm text-slate-500">Start by uploading your first tender PDF or TT_ template.</p>
      </div>
      <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
        <Plus className="size-4" />
        Add Your First Tender
      </Link>
    </div>
  );
}

function TenderDetails({
  tender,
  onClose,
  onEdit,
  onDelete
}: {
  tender: Tender;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const missingFields = [
    { label: "Tender Name", value: tender.tenderName },
    { label: "Authority", value: tender.authority },
    { label: "Tender ID", value: tender.tenderId },
    { label: "Portal Name", value: tender.portalName },
    { label: "Work Location", value: tender.workLocation },
    { label: "Client Department", value: tender.clientDepartment },
    { label: "Open Date", value: tender.openDate },
    { label: "Pre-bid Date", value: tender.preBidDate },
    { label: "Last Date", value: tender.lastDate },
    { label: "EMD", value: tender.emd },
    { label: "Tender Fee", value: tender.tenderFee },
    { label: "Estimated Cost", value: tender.estimatedCost },
    { label: "Bid Validity", value: tender.bidValidity },
    { label: "Work Completion Period", value: tender.workCompletionPeriod },
    { label: "Selection Method", value: tender.selectionMethod },
    { label: "Similar Work Criteria", value: tender.similarWorkCriteria },
    { label: "Technical Eligibility", value: tender.technicalEligibility },
    { label: "Financial Eligibility", value: tender.financialEligibility },
    { label: "Required Key Personnel", value: tender.requiredKeyPersonnel },
    { label: "Required Machinery", value: tender.requiredMachinery },
    { label: "Physical Document Submission", value: tender.physicalDocumentSubmission },
    { label: "Documents Required", value: tender.documentsRequired }
  ].filter((field) => !String(field.value || "").trim());

  const timeline = [
    { label: "Open Date", value: tender.openDate, tone: "bg-blue-100 text-blue-700" },
    { label: "Pre-bid Date", value: tender.preBidDate, tone: "bg-amber-100 text-amber-700" },
    { label: "Last Date", value: tender.lastDate, tone: "bg-red-100 text-red-700" },
    { label: "Technical Opening Date", value: "", tone: "bg-slate-100 text-slate-700" },
    { label: "Financial Opening Date", value: "", tone: "bg-slate-100 text-slate-700" }
  ];

  return (
    <Modal title="Tender Details" onClose={onClose}>
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Basic Details</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DetailField label="Tender Name" value={tender.tenderName} />
            <DetailField label="Authority" value={tender.authority} />
            <DetailField label="Tender ID" value={tender.tenderId} mono />
            <DetailField label="Portal Name" value={tender.portalName} />
            <DetailField label="Work Location" value={tender.workLocation} />
            <DetailField label="Client Department" value={tender.clientDepartment} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Key Dates Timeline</h3>
          <div className="mt-4 space-y-3">
            {timeline.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div className={`mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.tone}`}>{item.label}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {item.value ? formatTenderDate(item.value) : "Not available"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Financial Summary</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DetailField label="EMD" value={tender.emd} />
            <DetailField label="Tender Fee" value={tender.tenderFee} />
            <DetailField label="Estimated Cost" value={tender.estimatedCost} />
            <DetailField label="Bid Validity" value={tender.bidValidity} />
            <DetailField label="Work Completion Period" value={tender.workCompletionPeriod} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Eligibility</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DetailField label="Selection Method" value={tender.selectionMethod} />
            <DetailField label="Similar Work Criteria" value={tender.similarWorkCriteria} />
            <DetailField label="Technical Eligibility" value={tender.technicalEligibility} />
            <DetailField label="Financial Eligibility" value={tender.financialEligibility} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Requirements</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DetailField label="Required Key Personnel" value={tender.requiredKeyPersonnel} />
            <DetailField label="Required Machinery" value={tender.requiredMachinery} />
            <DetailField label="Physical Document Submission" value={tender.physicalDocumentSubmission} />
            <DetailField label="Documents Required" value={tender.documentsRequired} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Notes / Missing Data</h3>
          {missingFields.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <span
                  key={field.label}
                  className="inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
                >
                  {field.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No incomplete fields flagged for this tender.</p>
          )}
        </section>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
          Back to Dashboard
        </button>
        <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          <Pencil className="size-4" />
          Edit Tender
        </button>
        <button onClick={() => void onDelete()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          <Trash2 className="size-4" />
          Delete Tender
        </button>
      </div>
    </Modal>
  );
}

function DetailField({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "Not available"}</p>
    </div>
  );
}

function EditTenderModal({
  tender,
  isSaving,
  onClose,
  onSave,
  onChange
}: {
  tender: TenderInput;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (value: TenderInput) => void;
}) {
  return (
    <Modal title="Edit Tender" onClose={onClose}>
      <div className="grid max-h-[65vh] gap-3 overflow-auto pr-1 sm:grid-cols-2">
        {formFields.map((field) => {
          const isRequired = requiredPreviewFields.some((required) => required.key === field.key);
          const isBlankRequired = isRequired && !String(tender[field.key] ?? "").trim();
          return (
            <label key={field.key} className="grid gap-1 text-sm font-medium text-slate-700">
              <span className="flex items-center justify-between">
                {field.label}
                {isRequired ? <span className="text-xs font-semibold text-slate-500">Required</span> : <span className="text-xs text-slate-400">Optional</span>}
              </span>
              <input
                value={field.type === "datetime-local" ? toInputDate(tender[field.key]) : tender[field.key] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...tender,
                    [field.key]: field.type === "datetime-local" ? fromInputDate(event.target.value) : event.target.value
                  })
                }
                type={field.type ?? "text"}
                className={`rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  isBlankRequired ? "border-red-400 bg-red-50 focus:border-red-600 focus:ring-red-100" : "border-slate-300 bg-slate-50 focus:border-emerald-600 focus:ring-emerald-100"
                }`}
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
          Cancel
        </button>
        <button onClick={onSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
          <Check className="size-4" />
          Save
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.22)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-xl border border-slate-300 p-2 text-slate-700" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function compareTenderDates(a?: string | null, b?: string | null) {
  const aTime = a ? new Date(a).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b ? new Date(b).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function scheduleBrowserNotifications(notifications: ScheduledNotification[]) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  for (const notification of notifications) {
    const delay = new Date(notification.notifyAt).getTime() - Date.now();
    if (delay <= 0 || delay > 2_147_483_647) continue;
    window.setTimeout(() => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.showNotification(notification.title, {
            body: notification.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: notification.id,
            data: { url: "/" }
          });
        } else {
          new Notification(notification.title, { body: notification.body });
        }
      });
    }, delay);
  }
}
