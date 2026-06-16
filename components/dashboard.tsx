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

  const alerts = {
    today: filteredTenders.filter((tender) => daysLeft(tender.lastDate) === 0),
    tomorrow: filteredTenders.filter((tender) => daysLeft(tender.lastDate) === 1),
    week: filteredTenders.filter((tender) => {
      const left = daysLeft(tender.lastDate);
      return left !== null && left >= 0 && left <= 7;
    }),
    preBid: filteredTenders.filter((tender) => {
      const left = daysLeft(tender.preBidDate);
      return left !== null && left >= 0 && left <= 7;
    }),
    incomplete: filteredTenders.filter((tender) => !tender.tenderName || !tender.authority || !tender.lastDate || !tender.documentsRequired)
  };

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
          <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(21,128,61,0.18)]">
            <Plus className="size-4" />
            Add Tender
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {state.message ? <Banner message={state.message} /> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {summary.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ${item.accent}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
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

        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">Tender Dashboard Table</h2>
                <p className="text-sm text-slate-600">Key dates, values, status, and quick tender actions for daily follow-up.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[220px_150px_160px_150px_150px]">
                <label className="relative md:hidden">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                  <input
                    value={state.search}
                    onChange={(event) => setState((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search tender, ID, authority"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600"
                  />
                </label>
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
                <div className="flex gap-2">
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

          {state.isLoading ? <DashboardSkeleton /> : null}

          {!state.isLoading && filteredTenders.length === 0 ? (
            <EmptyState />
          ) : null}

          {!state.isLoading && filteredTenders.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1240px] divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Tender Name</th>
                      <th className="px-4 py-3">Authority</th>
                      <th className="px-4 py-3">Tender ID</th>
                      <th className="px-4 py-3">Last Date</th>
                      <th className="px-4 py-3">Pre-bid Date</th>
                      <th className="px-4 py-3">Open Date</th>
                      <th className="px-4 py-3">Days Left</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">EMD</th>
                      <th className="px-4 py-3">Estimated Cost</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTenders.map((tender) => (
                      <DesktopTenderRow
                        key={tender.id}
                        tender={tender}
                        onView={() => setViewTender(tender)}
                        onEdit={() => startEdit(tender)}
                        onDelete={() => void deleteTender(tender.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 lg:hidden">
                {filteredTenders.map((tender) => (
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

      {viewTender ? <TenderDetails tender={viewTender} onClose={() => setViewTender(null)} /> : null}
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

function DesktopTenderRow({
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
    <tr className="align-top transition hover:bg-slate-50">
      <td className="max-w-xs px-4 py-4 font-medium text-slate-950">{tender.tenderName || "-"}</td>
      <td className="px-4 py-4 text-slate-700">{tender.authority || "-"}</td>
      <td className="px-4 py-4 font-mono text-xs text-slate-700">{tender.tenderId || "-"}</td>
      <td className="px-4 py-4 text-slate-700">{formatTenderDate(tender.lastDate)}</td>
      <td className="px-4 py-4 text-slate-700">{formatTenderDate(tender.preBidDate)}</td>
      <td className="px-4 py-4 text-slate-700">{formatTenderDate(tender.openDate)}</td>
      <td className="px-4 py-4 font-semibold">{left === null ? "-" : left < 0 ? "Past" : left}</td>
      <td className="px-4 py-4">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status]}`}>{status}</span>
      </td>
      <td className="px-4 py-4 text-slate-700">{tender.emd || "-"}</td>
      <td className="px-4 py-4 text-slate-700">{tender.estimatedCost || "-"}</td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <ActionButton onClick={onView} aria="View tender details" icon={<Eye className="size-4" />} />
          <ActionButton onClick={onEdit} aria="Edit tender" icon={<Pencil className="size-4" />} />
          <ActionButton onClick={onDelete} aria="Delete tender" icon={<Trash2 className="size-4" />} danger />
        </div>
      </td>
    </tr>
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
          <p className="text-base font-semibold text-slate-950">{tender.tenderName || "-"}</p>
          <p className="mt-1 text-sm text-slate-600">{tender.authority || "-"}</p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyles[status]}`}>{status}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <InfoLine label="Last Date" value={formatTenderDate(tender.lastDate)} />
        <InfoLine label="Days Left" value={left === null ? "-" : left < 0 ? "Past" : String(left)} />
        <InfoLine label="Tender ID" value={tender.tenderId || "-"} />
        <InfoLine label="Estimated Cost" value={tender.estimatedCost || "-"} />
        <InfoLine label="EMD" value={tender.emd || "-"} />
      </div>
      <div className="mt-4 flex gap-2">
        <ActionPill onClick={onView} label="View" />
        <ActionPill onClick={onEdit} label="Edit" />
        <ActionPill onClick={onDelete} label="Delete" danger />
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

function ActionButton({ onClick, aria, icon, danger = false }: { onClick: () => void; aria: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className={`rounded-xl border p-2 ${danger ? "border-red-200 text-red-700" : "border-slate-300 text-slate-700"}`}
    >
      {icon}
    </button>
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

function TenderDetails({ tender, onClose }: { tender: Tender; onClose: () => void }) {
  const sections = [
    {
      title: "Basic tender info",
      fields: ["tenderName", "authority", "tenderId", "portalName"] as Array<keyof Tender>
    },
    {
      title: "Key dates",
      fields: ["lastDate", "preBidDate", "openDate"] as Array<keyof Tender>
    },
    {
      title: "Financial details",
      fields: ["emd", "tenderFee", "estimatedCost", "bidValidity", "workCompletionPeriod"] as Array<keyof Tender>
    },
    {
      title: "Eligibility and resources",
      fields: ["similarWorkCriteria", "technicalEligibility", "financialEligibility", "requiredKeyPersonnel", "requiredMachinery"] as Array<keyof Tender>
    },
    {
      title: "Documents and submission",
      fields: ["documentsRequired", "physicalDocumentSubmission", "workLocation", "clientDepartment"] as Array<keyof Tender>
    }
  ];

  return (
    <Modal title="Tender Details" onClose={onClose}>
      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{section.title}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {section.fields.map((fieldKey) => {
                const label = formFields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
                const value = fieldKey.includes("Date") ? formatTenderDate(String(tender[fieldKey] || "")) : String(tender[fieldKey] || "-");
                return (
                  <div key={String(fieldKey)} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-sm text-slate-900">{value}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
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

