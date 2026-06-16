import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ScheduledNotification, Tender, TenderInput } from "@/lib/tender-types";
import { normalizeTenderInput } from "@/lib/tender-types";

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
    selectionMethod: "",
    similarWorkCriteria: "",
    technicalEligibility: "",
    financialEligibility: "",
    requiredKeyPersonnel: "",
    requiredMachinery: "",
    physicalDocumentSubmission: "",
    documentsRequired: "",
    workLocation: "",
    clientDepartment: "",
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
    return { tender: created, notifications };
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  tenders.push(tender);
  await writeJsonFile(tendersFile, tenders);
  const notifications = await replaceTenderNotifications(tender);
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
    return { tender, notifications };
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  const index = tenders.findIndex((tender) => tender.id === id);
  if (index === -1) throw new Error("Tender not found.");
  tenders[index] = { ...tenders[index], ...patch, updatedAt: new Date().toISOString() };
  await writeJsonFile(tendersFile, tenders);
  const notifications = await replaceTenderNotifications(tenders[index]);
  return { tender: tenders[index], notifications };
}

export async function deleteTender(id: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const notificationDelete = await supabase.from("tender_notifications").delete().eq("tender_id", id);
    if (notificationDelete.error) throw new Error(notificationDelete.error.message);
    const tenderDelete = await supabase.from("tenders").delete().eq("id", id);
    if (tenderDelete.error) throw new Error(tenderDelete.error.message);
    return;
  }

  const tenders = await readJsonFile<Tender[]>(tendersFile, []);
  await writeJsonFile(
    tendersFile,
    tenders.filter((tender) => tender.id !== id)
  );
  await removeTenderNotifications(id);
}

export async function replaceTenderNotifications(tender: Tender) {
  const notifications = buildTenderNotifications(tender);
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
    createdAt: new Date().toISOString()
  });
}

export function buildTenderNotifications(tender: Tender) {
  const notifications: ScheduledNotification[] = [];
  addReminder(notifications, tender, "lastDate", tender.lastDate, 7 * 86_400_000, "in 7 days");
  addReminder(notifications, tender, "lastDate", tender.lastDate, 3 * 86_400_000, "in 3 days");
  addReminder(notifications, tender, "lastDate", tender.lastDate, 86_400_000, "tomorrow");
  addReminder(notifications, tender, "lastDate", tender.lastDate, 2 * 3_600_000, "in 2 hours");
  addReminder(notifications, tender, "preBidDate", tender.preBidDate, 86_400_000, "tomorrow");
  addReminder(notifications, tender, "preBidDate", tender.preBidDate, 2 * 3_600_000, "in 2 hours");
  return notifications.sort((a, b) => a.notifyAt.localeCompare(b.notifyAt));
}
