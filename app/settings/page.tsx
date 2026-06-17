"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Moon, Save, Sun } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { NotificationSettings, Tender } from "@/lib/tender-types";
import { toExportRow } from "@/components/tender-ui";

type CompanySettings = {
  companyName: string;
  defaultAuthority: string;
  defaultContactDetails: string;
  theme: "light" | "dark";
};

const defaultCompanySettings: CompanySettings = {
  companyName: "INNFRA CONSOL",
  defaultAuthority: "",
  defaultContactDetails: "",
  theme: "light"
};

const defaultNotificationSettings: NotificationSettings = {
  pushEnabled: true,
  dailyMorningEnabled: true,
  dailyEveningEnabled: true,
  dailyNightEnabled: true,
  morningTime: "09:00",
  eveningTime: "17:00",
  nightTime: "21:00",
  lastDateReminderDays: [7, 3, 1],
};

const preBidReminderDefaults = ["1 day before", "2 hours before"];
const dataLocation = "D:\\Adarsh\\Tender Tracker";

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanySettings>(defaultCompanySettings);
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotificationSettings);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [settingsResponse, tendersResponse] = await Promise.all([
        fetch("/api/notification-settings", { cache: "no-store" }),
        fetch("/api/tenders", { cache: "no-store" })
      ]);
      const settingsData = await settingsResponse.json();
      const tendersData = await tendersResponse.json();
      setNotifications(settingsData.settings ?? defaultNotificationSettings);
      setTenders(tendersData.tenders ?? []);

      const stored = window.localStorage.getItem("tt-company-settings");
      if (stored) {
        const parsed = JSON.parse(stored) as CompanySettings;
        setCompany({ ...defaultCompanySettings, ...parsed });
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ttTheme = company.theme;
  }, [company.theme]);

  const lastDateReminderText = useMemo(
    () =>
      notifications.lastDateReminderDays
        .slice()
        .sort((a, b) => b - a)
        .map((days) => (days === 1 ? "1 day before" : `${days} days before`))
        .join(", "),
    [notifications.lastDateReminderDays]
  );

  async function saveSettings() {
    setIsSaving(true);
    setMessage("");
    try {
      await fetch("/api/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications)
      });
      window.localStorage.setItem("tt-company-settings", JSON.stringify(company));
      setMessage("Settings saved.");
      window.dispatchEvent(new Event("tt:notifications-refresh"));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function exportRows(format: "csv" | "xlsx") {
    const rows = tenders.map(toExportRow);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tenders");
    XLSX.writeFile(workbook, `tender-tracker-settings-export.${format}`, { bookType: format === "csv" ? "csv" : "xlsx" });
  }

  function exportBackup() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            company,
            notifications,
            tenders
          },
          null,
          2
        )
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tender-tracker-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Settings"
      kicker="Workspace controls"
      actions={
        <button
          onClick={() => void saveSettings()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          <Save className="size-4" />
          Save Settings
        </button>
      }
    >
      <div className="space-y-5">
        {message ? <Banner message={message} /> : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card title="Company Settings" description="Workspace identity and default tender metadata.">
            <div className="grid gap-4">
              <Field label="Company name">
                <input
                  value={company.companyName}
                  onChange={(event) => setCompany((current) => ({ ...current, companyName: event.target.value }))}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </Field>
              <Field label="Default authority / department">
                <input
                  value={company.defaultAuthority}
                  onChange={(event) => setCompany((current) => ({ ...current, defaultAuthority: event.target.value }))}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </Field>
              <Field label="Default contact details">
                <textarea
                  value={company.defaultContactDetails}
                  onChange={(event) => setCompany((current) => ({ ...current, defaultContactDetails: event.target.value }))}
                  rows={3}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
              </Field>
            </div>
          </Card>

          <Card title="Data Location" description="All Tender Tracker data remains isolated in this workspace folder.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Storage path</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-900">{dataLocation}</p>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card title="Notification Settings" description="Push reminders, daily summaries, and default reminder preferences.">
            <div className="grid gap-4">
              <ToggleRow
                label="Enable push notifications"
                checked={notifications.pushEnabled}
                onChange={(checked) => setNotifications((current) => ({ ...current, pushEnabled: checked }))}
              />
              <ToggleRow
                label="Morning daily summary"
                checked={notifications.dailyMorningEnabled}
                onChange={(checked) => setNotifications((current) => ({ ...current, dailyMorningEnabled: checked }))}
              />
              <TimeRow
                label="Morning summary time"
                value={notifications.morningTime}
                onChange={(value) => setNotifications((current) => ({ ...current, morningTime: value }))}
              />
              <ToggleRow
                label="Evening daily summary"
                checked={notifications.dailyEveningEnabled}
                onChange={(checked) => setNotifications((current) => ({ ...current, dailyEveningEnabled: checked }))}
              />
              <TimeRow
                label="Evening summary time"
                value={notifications.eveningTime}
                onChange={(value) => setNotifications((current) => ({ ...current, eveningTime: value }))}
              />
              <ToggleRow
                label="Night daily summary"
                checked={notifications.dailyNightEnabled}
                onChange={(checked) => setNotifications((current) => ({ ...current, dailyNightEnabled: checked }))}
              />
              <TimeRow
                label="Night summary time"
                value={notifications.nightTime}
                onChange={(value) => setNotifications((current) => ({ ...current, nightTime: value }))}
              />
            </div>
          </Card>

          <Card title="Default Reminder Rules" description="Base reminder timing used for tender schedule generation.">
            <div className="space-y-4">
              <Field label="Default last date reminders">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{lastDateReminderText}</div>
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                {[7, 3, 1].map((day) => {
                  const checked = notifications.lastDateReminderDays.includes(day);
                  return (
                    <label key={day} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setNotifications((current) => ({
                            ...current,
                            lastDateReminderDays: event.target.checked
                              ? [...current.lastDateReminderDays, day].filter((value, index, array) => array.indexOf(value) === index)
                              : current.lastDateReminderDays.filter((value) => value !== day)
                          }))
                        }
                      />
                      <span>{day === 1 ? "1 day before" : `${day} days before`}</span>
                    </label>
                  );
                })}
              </div>
              <Field label="Default pre-bid reminders">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {preBidReminderDefaults.join(", ")}
                </div>
              </Field>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card title="Export Settings" description="Export tracker data in operational and backup formats.">
            <div className="grid gap-3 sm:grid-cols-3">
              <button onClick={() => exportRows("csv")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <Download className="size-4" />
                CSV Export
              </button>
              <button onClick={() => exportRows("xlsx")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <FileSpreadsheet className="size-4" />
                Excel Export
              </button>
              <button onClick={exportBackup} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
                <Download className="size-4" />
                Backup Export
              </button>
            </div>
          </Card>

          <Card title="Theme" description="Choose the workspace appearance preference.">
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemeOption
                title="Light mode"
                active={company.theme === "light"}
                icon={<Sun className="size-5" />}
                onClick={() => setCompany((current) => ({ ...current, theme: "light" }))}
              />
              <ThemeOption
                title="Dark mode"
                active={company.theme === "dark"}
                icon={<Moon className="size-5" />}
                onClick={() => setCompany((current) => ({ ...current, theme: "dark" }))}
              />
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function Card({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full transition ${checked ? "bg-emerald-700" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function TimeRow({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-600"
      />
    </Field>
  );
}

function ThemeOption({
  title,
  icon,
  active,
  onClick
}: {
  title: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white p-2 shadow-sm">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-500">{active ? "Selected theme" : "Click to select"}</p>
        </div>
      </div>
    </button>
  );
}

function Banner({ message }: { message: string }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>;
}
