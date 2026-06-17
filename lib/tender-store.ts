import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ScheduledNotification, Tender, TenderInput } from "@/lib/tender-types";
import { normalizeTenderInput } from "@/lib/tender-types";
import { createAppNotification, createUniqueNotification, getNotificationSettings } from "@/lib/notification-store";

type TenderRow = {
  id: string;
  tender_name: string;
  authority: string;
  open_date: string;
  last_date: string;
  pre_bid_date: string;
  tender_id: string;
  emd: string;
  tender_fee: string;
  estimated_cost: string;
  bid_validity: string;
  work_completion_period: string;
  portal_name: string;
  selection_method?: string;
  similar_work_criteria?: string;
  technical_eligibility?: string;
  financial_eligibility?: string;
  required_key_personnel?: string;
  required_machinery?: string;
  physical_document_submission?: string;
  documents_required?: string;
  work_location?: string;
  client_department?: string;
  source_file_name: string | null;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
};

const defaultDataDir = "D:\\Adarsh\\Tender Tracker";
const dataDir = process.env.TENDER_TRACKER_DATA_DIR || defaultDataDir;
const tendersFile = path.join(dataDir, "tenders.json");
const notificationsFile = path.join(dataDir, "notifications.json");

function fromRow(row: TenderRow): Tender {
  return {
    id: row.id,
    tenderName: row.tender_name,
    authority: row.authority,
    openDate: row.open_date,
    lastDate: row.last_date,
    preBidDate: row.pre_bid_date,
    tenderId: row.tender_id,
    emd: row.emd,
    tenderFee: row.tender_fee,
    estimatedCost: row.estimated_cost,
    bidValidity: row.bid_validity,
    workCompletionPeriod: row.work_completion_period,
    portalName: row.portal_name,
    selectionMethod: row.selection_method ?? "",
    similarWorkCriteria: row.similar_work_criteria ?? "",
    technicalEligibility: row.technical_eligibility ?? "",
    financialEligibility: row.financial_eligibility ?? "",
    requiredKeyPersonnel: row.required_key_personnel ?? "",
    requiredMachinery: row.required_machinery ?? "",
    physicalDocumentSubmission: row.physical_document_submission ?? "",
    documentsRequired: row.documents_required ?? "",
    workLocation: row.work_location ?? "",
    clientDepartment: row.client_department ?? "",
    sourceFileName: row.source_file_name ?? undefined,
    rawText: row.raw_text ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRow(tender: Tender): TenderRow {
  return {
    id: tender.id,
    tender_name: tender.tenderName,
    authority: tender.authority,
    open_date: tender.openDate,
    last_date: tender.lastDate,
    pre_bid_date: tender.preBidDate,
    tender_id: tender.tenderId,
    emd: tender.emd,
    tender_fee: tender.tenderFee,
    estimated_cost: tender.estimatedCost,
    bid_validity: tender.bidValidity,
    work_completion_period: tender.workCompletionPeriod,
    portal_name: tender.portalName,
    selection_method: tender.selectionMethod,
    similar_work_criteria: tender.similarWorkCriteria,
    technical_eligibility: tender.technicalEligibility,
    financial_eligibility: tender.financialEligibility,
    required_key_personnel: tender.requiredKeyPersonnel,
    required_machinery: tender.requiredMachinery,
    physical_document_submission: tender.physicalDocumentSubmission,
    documents_required: tender.documentsRequired,
    work_location: tender.workLocation,
    client_department: tender.clientDepartment,
    source_file_name: tender.sourceFileName ?? null,
    raw_text: tender.rawText ?? null,
    created_at: tender.createdAt,
    updated_at: tender.updatedAt
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

export function getTenderDataDir() {
  return dataDir;
}

export async function listTenders(): Promise<Tender[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("tenders").select("*").order("last_date", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as TenderRow[]).map(fromRow);
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  return tenders.sort((a, b) => (a.lastDate || "").localeCompare(b.lastDate || ""));
}

export async function listScheduledNotifications(): Promise<ScheduledNotification[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("tender_notifications").select("*").order("notify_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{
      id: string;
      tender_id: string;
      kind: ScheduledNotification["kind"];
      label: string;
      notify_at: string;
      title: string;
      body: string;
      source_ref?: string | null;
      delivered_at?: string | null;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      tenderId: row.tender_id,
      kind: row.kind,
      label: row.label,
      notifyAt: row.notify_at,
      title: row.title,
      body: row.body,
      sourceRef: row.source_ref ?? undefined,
      deliveredAt: row.delivered_at ?? undefined,
      createdAt: row.created_at
    }));
  }

  return readJsonFile<ScheduledNotification[]>(notificationsFile, []);
}

export async function markScheduledNotificationsDelivered(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from("tender_notifications")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw new Error(error.message);
    return;
  }

  const all = await readJsonFile<ScheduledNotification[]>(notificationsFile, []);
  await writeJsonFile(
    notificationsFile,
    all.map((item) => (ids.includes(item.id) ? { ...item, deliveredAt: new Date().toISOString() } : item))
  );
}

export async function createTender(input: TenderInput): Promise<{ tender: Tender; notifications: ScheduledNotification[] }> {
  const now = new Date().toISOString();
  const tender: Tender = {
    id: randomUUID(),
    ...normalizeTenderInput(input),
    createdAt: now,
    updatedAt: now
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("tenders").insert(toRow(tender)).select("*").single();
    if (error) throw new Error(error.message);
    const created = fromRow(data as TenderRow);
    const notifications = await replaceTenderNotifications(created);
    await createAppNotification({
      type: "tenderAdded",
      title: "Tender added successfully",
      body: `${created.tenderName || created.tenderId || "Tender"} was added to the dashboard.`,
      url: "/",
      level: "success",
      isImportant: false,
      tenderId: created.id
    });
    await createAppNotification({
      type: "reminderScheduled",
      title: "Reminder scheduled",
      body: `${notifications.length} reminder${notifications.length === 1 ? "" : "s"} scheduled for ${created.tenderName || created.tenderId || "tender"}.`,
      url: "/notifications",
      level: "info",
      isImportant: false,
      tenderId: created.id
    });
    if (!created.tenderName || !created.authority || !created.lastDate) {
      await createUniqueNotification({
        sourceRef: `missingRequiredFields:${created.id}:create`,
        type: "missingRequiredFields",
        title: "Tender has missing required fields",
        body: `${created.tenderName || created.tenderId || "Tender"} needs field review.`,
        url: "/",
        level: "warning",
        isImportant: true,
        tenderId: created.id
      });
    }
    return { tender: created, notifications };
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  tenders.push(tender);
  await writeJsonFile(tendersFile, tenders);
  const notifications = await replaceTenderNotifications(tender);
  await createAppNotification({
    type: "tenderAdded",
    title: "Tender added successfully",
    body: `${tender.tenderName || tender.tenderId || "Tender"} was added to the dashboard.`,
    url: "/",
    level: "success",
    isImportant: false,
    tenderId: tender.id
  });
  await createAppNotification({
    type: "reminderScheduled",
    title: "Reminder scheduled",
    body: `${notifications.length} reminder${notifications.length === 1 ? "" : "s"} scheduled for ${tender.tenderName || tender.tenderId || "tender"}.`,
    url: "/notifications",
    level: "info",
    isImportant: false,
    tenderId: tender.id
  });
  return { tender, notifications };
}

export async function updateTender(id: string, input: TenderInput): Promise<{ tender: Tender; notifications: ScheduledNotification[] }> {
  const patch = normalizeTenderInput(input);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("tenders")
      .update({
        tender_name: patch.tenderName,
        authority: patch.authority,
        open_date: patch.openDate,
        last_date: patch.lastDate,
        pre_bid_date: patch.preBidDate,
        tender_id: patch.tenderId,
        emd: patch.emd,
        tender_fee: patch.tenderFee,
        estimated_cost: patch.estimatedCost,
        bid_validity: patch.bidValidity,
        work_completion_period: patch.workCompletionPeriod,
        portal_name: patch.portalName,
        selection_method: patch.selectionMethod,
        similar_work_criteria: patch.similarWorkCriteria,
        technical_eligibility: patch.technicalEligibility,
        financial_eligibility: patch.financialEligibility,
        required_key_personnel: patch.requiredKeyPersonnel,
        required_machinery: patch.requiredMachinery,
        physical_document_submission: patch.physicalDocumentSubmission,
        documents_required: patch.documentsRequired,
        work_location: patch.workLocation,
        client_department: patch.clientDepartment,
        source_file_name: patch.sourceFileName ?? null,
        raw_text: patch.rawText ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const tender = fromRow(data as TenderRow);
    const notifications = await replaceTenderNotifications(tender);
    await createAppNotification({
      type: "tenderUpdated",
      title: "Tender updated",
      body: `${tender.tenderName || tender.tenderId || "Tender"} was updated.`,
      url: "/",
      level: "success",
      isImportant: false,
      tenderId: tender.id
    });
    await createAppNotification({
      type: "reminderScheduled",
      title: "Reminder scheduled",
      body: `${notifications.length} reminder${notifications.length === 1 ? "" : "s"} rescheduled for ${tender.tenderName || tender.tenderId || "tender"}.`,
      url: "/notifications",
      level: "info",
      isImportant: false,
      tenderId: tender.id
    });
    return { tender, notifications };
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  const index = tenders.findIndex((tender) => tender.id === id);
  if (index === -1) throw new Error("Tender not found.");
  tenders[index] = { ...tenders[index], ...patch, updatedAt: new Date().toISOString() };
  await writeJsonFile(tendersFile, tenders);
  const notifications = await replaceTenderNotifications(tenders[index]);
  await createAppNotification({
    type: "tenderUpdated",
    title: "Tender updated",
    body: `${tenders[index].tenderName || tenders[index].tenderId || "Tender"} was updated.`,
    url: "/",
    level: "success",
    isImportant: false,
    tenderId: tenders[index].id
  });
  await createAppNotification({
    type: "reminderScheduled",
    title: "Reminder scheduled",
    body: `${notifications.length} reminder${notifications.length === 1 ? "" : "s"} rescheduled for ${tenders[index].tenderName || tenders[index].tenderId || "tender"}.`,
    url: "/notifications",
    level: "info",
    isImportant: false,
    tenderId: tenders[index].id
  });
  return { tender: tenders[index], notifications };
}

export async function deleteTender(id: string) {
  const existing = await getTenderById(id);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const notificationDelete = await supabase.from("tender_notifications").delete().eq("tender_id", id);
    if (notificationDelete.error) throw new Error(notificationDelete.error.message);
    const tenderDelete = await supabase.from("tenders").delete().eq("id", id);
    if (tenderDelete.error) throw new Error(tenderDelete.error.message);
    if (existing) {
      await createAppNotification({
        type: "tenderDeleted",
        title: "Tender deleted",
        body: `${existing.tenderName || existing.tenderId || "Tender"} was deleted.`,
        url: "/notifications",
        level: "warning",
        isImportant: false,
        tenderId: id
      });
    }
    return;
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  await writeJsonFile(
    tendersFile,
    tenders.filter((tender) => tender.id !== id)
  );
  await removeTenderNotifications(id);
  if (existing) {
    await createAppNotification({
      type: "tenderDeleted",
      title: "Tender deleted",
      body: `${existing.tenderName || existing.tenderId || "Tender"} was deleted.`,
      url: "/notifications",
      level: "warning",
      isImportant: false,
      tenderId: id
    });
  }
}

export async function getTenderById(id: string) {
  const tenders = await listTenders();
  return tenders.find((tender) => tender.id === id) ?? null;
}

export async function replaceTenderNotifications(tender: Tender) {
  const notifications = await buildTenderNotifications(tender);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const notificationDelete = await supabase.from("tender_notifications").delete().eq("tender_id", tender.id);
    if (notificationDelete.error) throw new Error(notificationDelete.error.message);
    if (notifications.length > 0) {
      const { error } = await supabase.from("tender_notifications").insert(
        notifications.map((notification) => ({
          id: notification.id,
          tender_id: notification.tenderId,
          kind: notification.kind,
          label: notification.label,
          notify_at: notification.notifyAt,
          title: notification.title,
          body: notification.body,
          source_ref: notification.sourceRef ?? null,
          delivered_at: notification.deliveredAt ?? null,
          created_at: notification.createdAt
        }))
      );
      if (error) throw new Error(error.message);
    }
    return notifications;
  }

  const all = await readJsonFile<ScheduledNotification[]>(notificationsFile, []);
  const next = [...all.filter((notification) => notification.tenderId !== tender.id), ...notifications];
  await writeJsonFile(notificationsFile, next);
  return notifications;
}

async function removeTenderNotifications(tenderId: string) {
  const all = await readJsonFile<ScheduledNotification[]>(notificationsFile, []);
  await writeJsonFile(
    notificationsFile,
    all.filter((notification) => notification.tenderId !== tenderId)
  );
}

function addReminder(
  notifications: ScheduledNotification[],
  tender: Tender,
  kind: ScheduledNotification["kind"],
  dateValue: string,
  offsetMs: number,
  label: string
) {
  const due = new Date(dateValue);
  if (Number.isNaN(due.getTime())) return;
  const notifyAt = new Date(due.getTime() - offsetMs);
  if (notifyAt.getTime() <= Date.now()) return;

  const eventName = kind === "lastDate" ? "Last date" : "Pre-bid";
  notifications.push({
    id: randomUUID(),
    tenderId: tender.id,
    kind,
    label,
    notifyAt: notifyAt.toISOString(),
    title: `${eventName} reminder: ${tender.tenderName || tender.tenderId || "Tender"}`,
    body: `${eventName} for ${tender.authority || "authority"} is due ${label}.`,
    sourceRef: `${kind}:${tender.id}:${label}:${notifyAt.toISOString()}`,
    createdAt: new Date().toISOString()
  });
}

export async function buildTenderNotifications(tender: Tender) {
  const settings = await getNotificationSettings();
  const notifications: ScheduledNotification[] = [];
  for (const days of settings.lastDateReminderDays) {
    addReminder(notifications, tender, "lastDate", tender.lastDate, days * 86_400_000, days === 1 ? "tomorrow" : `in ${days} days`);
  }
  addReminder(notifications, tender, "lastDate", tender.lastDate, 2 * 3_600_000, "in 2 hours");
  addSameDayReminder(notifications, tender, "lastDate", tender.lastDate, 9, "today at 9:00 AM");
  addReminder(notifications, tender, "preBidDate", tender.preBidDate, 86_400_000, "tomorrow");
  addReminder(notifications, tender, "preBidDate", tender.preBidDate, 2 * 3_600_000, "in 2 hours");
  return notifications.sort((a, b) => a.notifyAt.localeCompare(b.notifyAt));
}

function addSameDayReminder(
  notifications: ScheduledNotification[],
  tender: Tender,
  kind: ScheduledNotification["kind"],
  value: string,
  hour: number,
  label: string
) {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return;
  const notifyAt = new Date(due);
  notifyAt.setHours(hour, 0, 0, 0);
  if (notifyAt.getTime() <= Date.now()) return;
  notifications.push({
    id: randomUUID(),
    tenderId: tender.id,
    kind,
    label,
    notifyAt: notifyAt.toISOString(),
    title: `Last date reminder: ${tender.tenderName || tender.tenderId || "Tender"}`,
    body: `Last date for ${tender.authority || "authority"} is due ${label}.`,
    sourceRef: `${kind}:${tender.id}:${label}:${notifyAt.toISOString()}`,
    createdAt: new Date().toISOString()
  });
}
