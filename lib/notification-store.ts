import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AppNotification, NotificationSettings, ScheduledNotification, Tender } from "@/lib/tender-types";
import { daysLeft } from "@/lib/tender-types";

const defaultDataDir = "D:\\Adarsh\\Tender Tracker";
const dataDir = process.env.TENDER_TRACKER_DATA_DIR || defaultDataDir;
const appNotificationsFile = path.join(dataDir, "app-notifications.json");
const notificationSettingsFile = path.join(dataDir, "notification-settings.json");

type AppNotificationRow = {
  id: string;
  type: AppNotification["type"];
  title: string;
  body: string;
  url: string;
  level: AppNotification["level"];
  is_read: boolean;
  is_important: boolean;
  tender_id: string | null;
  source_ref: string | null;
  created_at: string;
};

type NotificationSettingsRow = {
  id: string;
  push_enabled: boolean;
  daily_morning_enabled: boolean;
  daily_evening_enabled: boolean;
  daily_night_enabled: boolean;
  morning_time: string;
  evening_time: string;
  night_time: string;
  last_date_reminder_days: number[];
  updated_at?: string;
};

const defaultSettings: NotificationSettings = {
  pushEnabled: true,
  dailyMorningEnabled: true,
  dailyEveningEnabled: true,
  dailyNightEnabled: true,
  morningTime: "09:00",
  eveningTime: "17:00",
  nightTime: "21:00",
  lastDateReminderDays: [7, 3, 1]
};

function fromNotificationRow(row: AppNotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    level: row.level,
    isRead: row.is_read,
    isImportant: row.is_important,
    tenderId: row.tender_id ?? undefined,
    sourceRef: row.source_ref ?? undefined,
    createdAt: row.created_at
  };
}

function toNotificationRow(notification: AppNotification): AppNotificationRow {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    level: notification.level,
    is_read: notification.isRead,
    is_important: notification.isImportant,
    tender_id: notification.tenderId ?? null,
    source_ref: notification.sourceRef ?? null,
    created_at: notification.createdAt
  };
}

function fromSettingsRow(row: NotificationSettingsRow): NotificationSettings {
  return {
    pushEnabled: row.push_enabled,
    dailyMorningEnabled: row.daily_morning_enabled,
    dailyEveningEnabled: row.daily_evening_enabled,
    dailyNightEnabled: row.daily_night_enabled,
    morningTime: row.morning_time,
    eveningTime: row.evening_time,
    nightTime: row.night_time,
    lastDateReminderDays: row.last_date_reminder_days
  };
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isSchemaCompatibilityError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("relation") ||
    text.includes("schema cache") ||
    text.includes("could not find")
  );
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("notification_settings").select("*").eq("id", "default").maybeSingle();
    if (error) {
      if (isSchemaCompatibilityError(error.message)) return defaultSettings;
      throw new Error(error.message);
    }
    if (!data) return defaultSettings;
    return fromSettingsRow(data as NotificationSettingsRow);
  }

  return readJsonFile(notificationSettingsFile, defaultSettings);
}

export async function updateNotificationSettings(patch: Partial<NotificationSettings>) {
  const next = { ...(await getNotificationSettings()), ...patch };
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const row: NotificationSettingsRow = {
      id: "default",
      push_enabled: next.pushEnabled,
      daily_morning_enabled: next.dailyMorningEnabled,
      daily_evening_enabled: next.dailyEveningEnabled,
      daily_night_enabled: next.dailyNightEnabled,
      morning_time: next.morningTime,
      evening_time: next.eveningTime,
      night_time: next.nightTime,
      last_date_reminder_days: next.lastDateReminderDays,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("notification_settings").upsert(row, { onConflict: "id" });
    if (error) {
      if (isSchemaCompatibilityError(error.message)) return next;
      throw new Error(error.message);
    }
    return next;
  }

  await writeJsonFile(notificationSettingsFile, next);
  return next;
}

export async function listAppNotifications(filter: "all" | "unread" | "important" = "all") {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    let query = supabase.from("app_notifications").select("*").order("created_at", { ascending: false });
    if (filter === "unread") query = query.eq("is_read", false);
    if (filter === "important") query = query.eq("is_important", true);
    const { data, error } = await query.limit(200);
    if (error) {
      if (isSchemaCompatibilityError(error.message)) return [];
      throw new Error(error.message);
    }
    return ((data ?? []) as AppNotificationRow[]).map(fromNotificationRow);
  }

  const all = await readJsonFile<AppNotification[]>(appNotificationsFile, []);
  return all
    .filter((item) => (filter === "all" ? true : filter === "unread" ? !item.isRead : item.isImportant))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAppNotification(input: Omit<AppNotification, "id" | "createdAt" | "isRead"> & { id?: string; createdAt?: string; isRead?: boolean }) {
  const notification: AppNotification = {
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    isRead: input.isRead ?? false,
    ...input
  };
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("app_notifications").upsert(toNotificationRow(notification), { onConflict: "id" });
    if (error) {
      if (isSchemaCompatibilityError(error.message)) return notification;
      throw new Error(error.message);
    }
    return notification;
  }

  const all = await readJsonFile<AppNotification[]>(appNotificationsFile, []);
  const deduped = all.filter((item) => item.id !== notification.id && item.sourceRef !== notification.sourceRef);
  deduped.unshift(notification);
  await writeJsonFile(appNotificationsFile, deduped);
  return notification;
}

export async function createUniqueNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "isRead"> & { sourceRef: string }
) {
  const existing = await findNotificationBySourceRef(input.sourceRef);
  if (existing) return existing;
  return createAppNotification(input);
}

export async function findNotificationBySourceRef(sourceRef: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("app_notifications").select("*").eq("source_ref", sourceRef).maybeSingle();
    if (error) {
      if (isSchemaCompatibilityError(error.message)) return null;
      throw new Error(error.message);
    }
    return data ? fromNotificationRow(data as AppNotificationRow) : null;
  }

  const all = await readJsonFile<AppNotification[]>(appNotificationsFile, []);
  return all.find((item) => item.sourceRef === sourceRef) ?? null;
}

export async function markNotificationRead(id: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("app_notifications").update({ is_read: true }).eq("id", id);
    if (error && !isSchemaCompatibilityError(error.message)) throw new Error(error.message);
    return;
  }

  const all = await readJsonFile<AppNotification[]>(appNotificationsFile, []);
  await writeJsonFile(
    appNotificationsFile,
    all.map((item) => (item.id === id ? { ...item, isRead: true } : item))
  );
}

export async function clearAllNotifications() {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("app_notifications").delete().neq("id", "");
    if (error && !isSchemaCompatibilityError(error.message)) throw new Error(error.message);
    return;
  }
  await writeJsonFile(appNotificationsFile, []);
}

export async function getUnreadNotificationCount() {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { count, error } = await supabase.from("app_notifications").select("*", { count: "exact", head: true }).eq("is_read", false);
    if (error) {
      if (isSchemaCompatibilityError(error.message)) return 0;
      throw new Error(error.message);
    }
    return count ?? 0;
  }
  const all = await readJsonFile<AppNotification[]>(appNotificationsFile, []);
  return all.filter((item) => !item.isRead).length;
}

export async function syncDerivedNotifications({
  tenders,
  scheduledNotifications
}: {
  tenders: Tender[];
  scheduledNotifications: ScheduledNotification[];
}) {
  const settings = await getNotificationSettings();
  const dueScheduled = scheduledNotifications.filter(
    (item) => !item.deliveredAt && new Date(item.notifyAt).getTime() <= Date.now()
  );

  for (const scheduled of dueScheduled) {
    await createUniqueNotification({
      sourceRef: scheduled.sourceRef ?? `scheduled:${scheduled.id}`,
      type: scheduled.kind === "lastDate" ? "deadlineApproaching" : "preBidTomorrow",
      title: scheduled.title,
      body: scheduled.body,
      url: "/",
      level: scheduled.kind === "lastDate" ? "warning" : "info",
      isImportant: true,
      tenderId: scheduled.tenderId
    });
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  for (const tender of tenders) {
    const last = daysLeft(tender.lastDate);
    const preBid = daysLeft(tender.preBidDate);

    if (last === 0) {
      await createUniqueNotification({
        sourceRef: `closingToday:${tender.id}:${todayKey}`,
        type: "closingToday",
        title: "Tender closing today",
        body: `${tender.tenderName || tender.tenderId || "Tender"} closes today.`,
        url: "/",
        level: "critical",
        isImportant: true,
        tenderId: tender.id
      });
    }
    if (last === 1) {
      await createUniqueNotification({
        sourceRef: `closingTomorrow:${tender.id}:${todayKey}`,
        type: "closingTomorrow",
        title: "Tender closing tomorrow",
        body: `${tender.tenderName || tender.tenderId || "Tender"} closes tomorrow.`,
        url: "/",
        level: "warning",
        isImportant: true,
        tenderId: tender.id
      });
    }
    if (last !== null && last >= 0 && last <= 7) {
      await createUniqueNotification({
        sourceRef: `closingWithin7Days:${tender.id}:${todayKey}`,
        type: "closingWithin7Days",
        title: "Tender closing within 7 days",
        body: `${tender.tenderName || tender.tenderId || "Tender"} closes within 7 days.`,
        url: "/",
        level: "warning",
        isImportant: false,
        tenderId: tender.id
      });
    }
    if (preBid === 1) {
      await createUniqueNotification({
        sourceRef: `preBidTomorrow:${tender.id}:${todayKey}`,
        type: "preBidTomorrow",
        title: "Pre-bid meeting tomorrow",
        body: `${tender.tenderName || tender.tenderId || "Tender"} has a pre-bid meeting tomorrow.`,
        url: "/",
        level: "info",
        isImportant: true,
        tenderId: tender.id
      });
    }
    if (!tender.tenderName || !tender.authority || !tender.lastDate || !tender.documentsRequired) {
      await createUniqueNotification({
        sourceRef: `missingRequiredFields:${tender.id}:${todayKey}`,
        type: "missingRequiredFields",
        title: "Tender has missing required fields",
        body: `${tender.tenderName || tender.tenderId || "Tender"} needs field review before follow-up.`,
        url: "/",
        level: "warning",
        isImportant: true,
        tenderId: tender.id
      });
    }
  }

  await createDailyDigests(settings, tenders, todayKey);
}

async function createDailyDigests(settings: NotificationSettings, tenders: Tender[], todayKey: string) {
  const today = new Date();
  const stats = buildDigestStats(tenders);
  const configs: Array<{
    enabled: boolean;
    time: string;
    type: AppNotification["type"];
    title: string;
    body: string;
    key: string;
  }> = [
    {
      enabled: settings.dailyMorningEnabled,
      time: settings.morningTime,
      type: "dailyMorningSummary",
      title: "Morning Tender Summary",
      body: `Closing today: ${stats.closingToday}. Within 7 days: ${stats.within7Days}. Pre-bid meetings today: ${stats.preBidToday}. Incomplete tenders: ${stats.incomplete}.`,
      key: "morning"
    },
    {
      enabled: settings.dailyEveningEnabled,
      time: settings.eveningTime,
      type: "dailyEveningSummary",
      title: "Evening Tender Follow-up",
      body: `Pending tender actions: ${stats.pending}. Closing tomorrow: ${stats.closingTomorrow}. Documents missing: ${stats.incomplete}. Important reminders: ${stats.important}.`,
      key: "evening"
    },
    {
      enabled: settings.dailyNightEnabled,
      time: settings.nightTime,
      type: "dailyNightSummary",
      title: "Night Tender Reminder",
      body: `Tomorrow's deadlines: ${stats.closingTomorrow}. Tomorrow's pre-bid meetings: ${stats.preBidTomorrow}. Urgent tenders: ${stats.urgent}. Critical tenders: ${stats.critical}.`,
      key: "night"
    }
  ];

  for (const config of configs) {
    if (!config.enabled || !hasTimePassed(today, config.time)) continue;
    await createUniqueNotification({
      sourceRef: `digest:${config.key}:${todayKey}`,
      type: config.type,
      title: config.title,
      body: config.body,
      url: "/notifications",
      level: "info",
      isImportant: config.key !== "evening"
    });
  }
}

function hasTimePassed(now: Date, time: string) {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  const compare = new Date(now);
  compare.setHours(hours || 0, minutes || 0, 0, 0);
  return now.getTime() >= compare.getTime();
}

function buildDigestStats(tenders: Tender[]) {
  const closingToday = tenders.filter((tender) => daysLeft(tender.lastDate) === 0).length;
  const closingTomorrow = tenders.filter((tender) => daysLeft(tender.lastDate) === 1).length;
  const within7Days = tenders.filter((tender) => {
    const left = daysLeft(tender.lastDate);
    return left !== null && left >= 0 && left <= 7;
  }).length;
  const preBidToday = tenders.filter((tender) => daysLeft(tender.preBidDate) === 0).length;
  const preBidTomorrow = tenders.filter((tender) => daysLeft(tender.preBidDate) === 1).length;
  const incomplete = tenders.filter((tender) => !tender.tenderName || !tender.authority || !tender.lastDate || !tender.documentsRequired).length;
  const urgent = tenders.filter((tender) => {
    const left = daysLeft(tender.lastDate);
    return left !== null && left >= 3 && left <= 7;
  }).length;
  const critical = tenders.filter((tender) => {
    const left = daysLeft(tender.lastDate);
    return left !== null && left >= 0 && left <= 2;
  }).length;
  return {
    closingToday,
    closingTomorrow,
    within7Days,
    preBidToday,
    preBidTomorrow,
    incomplete,
    urgent,
    critical,
    pending: within7Days + incomplete,
    important: critical + preBidTomorrow + closingTomorrow
  };
}
