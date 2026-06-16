"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  Download,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import type { ScheduledNotification, Tender, TenderInput } from "@/lib/tender-types";
import { daysLeft, formatTenderDate, getTenderStatus, normalizeTenderInput } from "@/lib/tender-types";
import {
  blankTender,
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

type DateBucket = "today" | "tomorrow" | "week";

export function Dashboard() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [portalFilter, setPortalFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewTender, setViewTender] = useState<Tender | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTender, setEditTender] = useState<TenderInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadTenders();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const portals = useMemo(
    () => ["All", ...Array.from(new Set(tenders.map((tender) => tender.portalName).filter(Boolean))).sort()],
    [tenders]
  );

  const filteredTenders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenders.filter((tender) => {
      const status = getTenderStatus(tender.lastDate);
      const lastDate = tender.lastDate ? new Date(tender.lastDate) : null;
      const matchesSearch =
        !query ||
        [tender.tenderName, tender.tenderId, tender.authority].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      const matchesPortal = portalFilter === "All" || tender.portalName === portalFilter;
      const matchesDateFrom = !dateFrom || (lastDate && lastDate >= new Date(`${dateFrom}T00:00:00`));
      const matchesDateTo = !dateTo || (lastDate && lastDate <= new Date(`${dateTo}T23:59:59`));
      return matchesSearch && matchesStatus && matchesPortal && matchesDateFrom && matchesDateTo;
    });
  }, [dateFrom, dateTo, portalFilter, search, statusFilter, tenders]);

  const activeTenders = tenders.filter((tender) => getTenderStatus(tender.lastDate) !== "Closed");
  const closingThisWeek = tenders.filter((tender) => {
    const left = daysLeft(tender.lastDate);
    return left !== null && left >= 0 && left <= 7;
  });
  const totalEstimatedValue = tenders.reduce((sum, tender) => sum + moneyValue(tender.estimatedCost), 0);
  const alerts = buildAlerts(tenders);

  async function loadTenders() {
    const response = await fetch("/api/tenders", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setTenders(data.tenders);
    else setMessage(data.error ?? "Unable to load tenders.");
  }

  async function deleteTender(id: string) {
    const response = await fetch(`/api/tenders/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Unable to delete tender.");
      return;
    }
    setTenders((items) => items.filter((tender) => tender.id !== id));
    setMessage("Tender deleted and related reminders removed.");
  }

  async function saveEdit() {
    if (!editId || !editTender) return;
    setIsSaving(true);
    setMessage("");
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
      setMessage("Tender updated and reminders rescheduled.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsSaving(false);
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
    setMessage(`Imported ${imported} tender${imported === 1 ? "" : "s"}.`);
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-20 text-slate-950 md:pb-0">
      <AppHeader />
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Tender follow-up</p>
            <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <Link href="/upload" className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              <Plus className="size-4" />
              Add Tender
            </Link>
            <button onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <FileSpreadsheet className="size-4" />
              Import
            </button>
            <button onClick={() => exportRows("csv")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <Download className="size-4" />
              CSV
            </button>
            <button onClick={() => exportRows("xlsx")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <Download className="size-4" />
              Excel
            </button>
          </div>
        </section>

        {message ? <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Total Active Tenders" value={activeTenders.length} />
          <Metric label="Critical Tenders" value={tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Critical").length} />
          <Metric label="Urgent Tenders" value={tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Urgent").length} />
          <Metric label="Closing This Week" value={closingThisWeek.length} />
          <Metric label="Closed Tenders" value={tenders.filter((tender) => getTenderStatus(tender.lastDate) === "Closed").length} />
          <Metric label="Total Estimated Value" value={formatMoney(totalEstimatedValue)} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-700" />
              <h2 className="text-base font-semibold">Important Tender Alerts</h2>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-5">
            <AlertList title="Closing today" tenders={alerts.today} />
            <AlertList title="Closing tomorrow" tenders={alerts.tomorrow} />
            <AlertList title="Within 7 days" tenders={alerts.week} />
            <AlertList title="Pre-bid meetings" tenders={alerts.preBid} />
            <AlertList title="Incomplete tenders" tenders={alerts.incomplete} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-semibold">Tender Dashboard Table</h2>
                <p className="text-sm text-slate-600">Deadlines, status, values, and follow-up actions.</p>
              </div>
              <div className="grid gap-2 lg:grid-cols-[280px_150px_170px_150px_150px]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tender, ID, authority"
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600"
                  />
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none">
                  {(["All", "Critical", "Urgent", "Upcoming", "Active", "Closed"] as StatusFilter[]).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <select value={portalFilter} onChange={(event) => setPortalFilter(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none">
                  {portals.map((portal) => (
                    <option key={portal}>{portal}</option>
                  ))}
                </select>
                <input value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none" />
                <input value={dateTo} onChange={(event) => setDateTo(event.target.value)} type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
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
                  <th className="px-4 py-3">Tender Fee</th>
                  <th className="px-4 py-3">Estimated Cost</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenders.map((tender) => {
                  const status = getTenderStatus(tender.lastDate);
                  const left = daysLeft(tender.lastDate);
                  return (
                    <tr key={tender.id} className="align-top">
                      <td className="max-w-xs px-4 py-3 font-medium text-slate-950">{tender.tenderName || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{tender.authority || "-"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{tender.tenderId || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{formatTenderDate(tender.lastDate)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatTenderDate(tender.preBidDate)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatTenderDate(tender.openDate)}</td>
                      <td className="px-4 py-3 font-semibold">{left === null ? "-" : left < 0 ? "Past" : left}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{tender.emd || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{tender.tenderFee || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{tender.estimatedCost || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setViewTender(tender)} aria-label="View tender details" className="rounded-md border border-slate-300 p-2 text-slate-700">
                            <Eye className="size-4" />
                          </button>
                          <button onClick={() => startEdit(tender)} aria-label="Edit tender" className="rounded-md border border-slate-300 p-2 text-slate-700">
                            <Pencil className="size-4" />
                          </button>
                          <button onClick={() => void deleteTender(tender.id)} aria-label="Delete tender" className="rounded-md border border-red-200 p-2 text-red-700">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTenders.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                      No tenders match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {viewTender ? <TenderDetails tender={viewTender} onClose={() => setViewTender(null)} /> : null}
      {editTender ? (
        <EditTenderModal
          tender={editTender}
          isSaving={isSaving}
          onClose={() => {
            setEditTender(null);
            setEditId(null);
          }}
          onSave={() => void saveEdit()}
          onChange={setEditTender}
        />
      ) : null}
    </main>
  );
}

function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Civil Consultancy</p>
          <p className="mt-1 text-xl font-semibold">Tender Tracker</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link className="rounded-md bg-slate-950 px-3 py-2 text-white" href="/">Dashboard</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/upload">Upload Tender</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/calendar">Calendar</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/reports">Reports</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/settings">Settings</Link>
        </nav>
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <CalendarClock className="size-4 shrink-0 text-emerald-700" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function AlertList({ title, tenders }: { title: string; tenders: Tender[] }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="mt-2 space-y-2">
        {tenders.slice(0, 4).map((tender) => (
          <p key={tender.id} className="text-xs leading-5 text-slate-600">
            <span className="font-semibold text-slate-800">{tender.tenderName || tender.tenderId || "Tender"}</span>
            <br />
            {formatTenderDate(title === "Pre-bid meetings" ? tender.preBidDate : tender.lastDate)}
          </p>
        ))}
        {tenders.length === 0 ? <p className="text-xs text-slate-500">No items</p> : null}
      </div>
    </div>
  );
}

function TenderDetails({ tender, onClose }: { tender: Tender; onClose: () => void }) {
  return (
    <Modal title="Tender Details" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        {formFields.map((field) => (
          <div key={field.key} className="rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">{field.label}</p>
            <p className="mt-1 text-sm text-slate-900">{String(tender[field.key] || "-")}</p>
          </div>
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
                {isBlankRequired ? <span className="text-xs font-semibold text-red-700">Required</span> : null}
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
                className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  isBlankRequired ? "border-red-400 bg-red-50 focus:border-red-600 focus:ring-red-100" : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100"
                }`}
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
          Cancel
        </button>
        <button onClick={onSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
          <Check className="size-4" />
          Save
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md border border-slate-300 p-2 text-slate-700" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function buildAlerts(tenders: Tender[]) {
  return {
    today: byBucket(tenders, "today"),
    tomorrow: byBucket(tenders, "tomorrow"),
    week: byBucket(tenders, "week"),
    preBid: tenders.filter((tender) => {
      const left = daysLeft(tender.preBidDate);
      return left !== null && left >= 0 && left <= 7;
    }),
    incomplete: tenders.filter((tender) => !tender.tenderName || !tender.authority || !tender.lastDate || !tender.documentsRequired)
  };
}

function byBucket(tenders: Tender[], bucket: DateBucket) {
  return tenders.filter((tender) => {
    const left = daysLeft(tender.lastDate);
    if (bucket === "today") return left === 0;
    if (bucket === "tomorrow") return left === 1;
    return left !== null && left >= 0 && left <= 7;
  });
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

