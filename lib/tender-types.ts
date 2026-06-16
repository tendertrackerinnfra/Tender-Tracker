export type TenderStatus = "Critical" | "Urgent" | "Upcoming" | "Active" | "Closed";

export type Tender = {
  id: string;
  tenderName: string;
  authority: string;
  openDate: string;
  lastDate: string;
  preBidDate: string;
  tenderId: string;
  emd: string;
  tenderFee: string;
  estimatedCost: string;
  bidValidity: string;
  workCompletionPeriod: string;
  portalName: string;
  selectionMethod: string;
  similarWorkCriteria: string;
  technicalEligibility: string;
  financialEligibility: string;
  requiredKeyPersonnel: string;
  requiredMachinery: string;
  physicalDocumentSubmission: string;
  documentsRequired: string;
  workLocation: string;
  clientDepartment: string;
  sourceFileName?: string;
  rawText?: string;
  createdAt: string;
  updatedAt: string;
};

export type TenderInput = Omit<Tender, "id" | "createdAt" | "updatedAt">;
export type TenderInputKey = keyof TenderInput;
export type ExtractionConfidence = "high" | "medium" | "low";

export type TenderFieldDebug = {
  value: string;
  confidence: ExtractionConfidence;
  sourceLineNumber: number | null;
  sourceLineText: string;
  matchedKeyword: string;
  source: string;
};

export type ScheduledNotification = {
  id: string;
  tenderId: string;
  kind: "lastDate" | "preBidDate";
  label: string;
  notifyAt: string;
  title: string;
  body: string;
  createdAt: string;
};

export type TenderExtraction = TenderInput & {
  confidence: ExtractionConfidence;
  extractionNotes: string[];
  extractionDebug: Partial<Record<TenderInputKey, TenderFieldDebug>>;
};

export function normalizeTenderInput(input: Partial<TenderInput>): TenderInput {
  return {
    tenderName: input.tenderName?.trim() ?? "",
    authority: input.authority?.trim() ?? "",
    openDate: normalizeDate(input.openDate),
    lastDate: normalizeDate(input.lastDate),
    preBidDate: normalizeDate(input.preBidDate),
    tenderId: input.tenderId?.trim() ?? "",
    emd: input.emd?.trim() ?? "",
    tenderFee: input.tenderFee?.trim() ?? "",
    estimatedCost: input.estimatedCost?.trim() ?? "",
    bidValidity: input.bidValidity?.trim() ?? "",
    workCompletionPeriod: input.workCompletionPeriod?.trim() ?? "",
    portalName: input.portalName?.trim() ?? "",
    selectionMethod: input.selectionMethod?.trim() ?? "",
    similarWorkCriteria: input.similarWorkCriteria?.trim() ?? "",
    technicalEligibility: input.technicalEligibility?.trim() ?? "",
    financialEligibility: input.financialEligibility?.trim() ?? "",
    requiredKeyPersonnel: input.requiredKeyPersonnel?.trim() ?? "",
    requiredMachinery: input.requiredMachinery?.trim() ?? "",
    physicalDocumentSubmission: input.physicalDocumentSubmission?.trim() ?? "",
    documentsRequired: input.documentsRequired?.trim() ?? "",
    workLocation: input.workLocation?.trim() ?? "",
    clientDepartment: input.clientDepartment?.trim() ?? "",
    sourceFileName: input.sourceFileName?.trim() || undefined,
    rawText: input.rawText
  };
}

export function normalizeDate(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toISOString();
  }
  const parsed = parseTenderDate(text);
  return parsed ? parsed.toISOString() : text;
}

export function parseTenderDate(value: string) {
  const cleaned = value
    .replace(/\bat\b/i, " ")
    .replace(/\bhrs?\.?\b/i, "")
    .replace(/\bhours?\b/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const isoMatch = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2})(?::|\.)(\d{2})(?:\s*(AM|PM))?)?/i);
  if (isoMatch) {
    let hour = Number(isoMatch[4] ?? 0);
    const minute = Number(isoMatch[5] ?? 0);
    const meridiem = isoMatch[6]?.toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    const parsed = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), hour, minute);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = cleaned.match(/(\d{1,2})[-/.\s](\d{1,2}|jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[-/.\s](\d{2,4})(?:\s+(?:up\s*to\s*)?(\d{1,2})(?::|\.)(\d{2})(?:\s*(AM|PM))?)?/i);
  if (!match) return null;

  const day = Number(match[1]);
  const month = parseMonth(match[2]);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  let hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const meridiem = match[6]?.toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  const parsed = new Date(year, month, day, hour, minute);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseMonth(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric - 1;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const key = value.toLowerCase().slice(0, 3);
  return Math.max(0, months.indexOf(key));
}

export function formatTenderDate(value: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function daysLeft(lastDate: string, now = new Date()) {
  const date = lastDate ? new Date(lastDate) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

export function getTenderStatus(lastDate: string, now = new Date()): TenderStatus {
  const remaining = daysLeft(lastDate, now);
  if (remaining === null) return "Active";
  if (remaining < 0) return "Closed";
  if (remaining <= 2) return "Critical";
  if (remaining <= 7) return "Urgent";
  if (remaining <= 15) return "Upcoming";
  return "Active";
}
