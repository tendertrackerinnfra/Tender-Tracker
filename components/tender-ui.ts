"use client";

import type { Tender, TenderInput } from "@/lib/tender-types";
import { daysLeft, getTenderStatus } from "@/lib/tender-types";

export const blankTender: TenderInput = {
  tenderName: "",
  authority: "",
  openDate: "",
  lastDate: "",
  preBidDate: "",
  tenderId: "",
  emd: "",
  tenderFee: "",
  estimatedCost: "",
  bidValidity: "",
  workCompletionPeriod: "",
  portalName: "",
  selectionMethod: "",
  similarWorkCriteria: "",
  technicalEligibility: "",
  financialEligibility: "",
  requiredKeyPersonnel: "",
  requiredMachinery: "",
  physicalDocumentSubmission: "",
  documentsRequired: "",
  workLocation: "",
  clientDepartment: ""
};

export const formFields: Array<{ key: keyof TenderInput; label: string; type?: string }> = [
  { key: "tenderName", label: "Tender Name" },
  { key: "authority", label: "Authority" },
  { key: "lastDate", label: "Last Date", type: "datetime-local" },
  { key: "preBidDate", label: "Pre-bid Date", type: "datetime-local" },
  { key: "openDate", label: "Open Date", type: "datetime-local" },
  { key: "tenderId", label: "Tender ID" },
  { key: "emd", label: "EMD" },
  { key: "tenderFee", label: "Tender Fee" },
  { key: "estimatedCost", label: "Estimated Cost" },
  { key: "bidValidity", label: "Bid Validity" },
  { key: "workCompletionPeriod", label: "Work Completion Period" },
  { key: "portalName", label: "Portal Name" },
  { key: "selectionMethod", label: "Selection Method" },
  { key: "similarWorkCriteria", label: "Similar Work Criteria" },
  { key: "technicalEligibility", label: "Technical Eligibility" },
  { key: "financialEligibility", label: "Financial Eligibility" },
  { key: "requiredKeyPersonnel", label: "Required Key Personnel" },
  { key: "requiredMachinery", label: "Required Machinery" },
  { key: "physicalDocumentSubmission", label: "Physical Document Submission" },
  { key: "documentsRequired", label: "Documents Required" },
  { key: "workLocation", label: "Work Location" },
  { key: "clientDepartment", label: "Client Department" }
];

export const requiredPreviewFields = formFields.filter((field) => ["tenderName", "authority", "lastDate"].includes(field.key));

export const statusStyles = {
  Critical: "bg-red-100 text-red-800 ring-red-200",
  Urgent: "bg-amber-100 text-amber-800 ring-amber-200",
  Upcoming: "bg-blue-100 text-blue-800 ring-blue-200",
  Active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Closed: "bg-slate-200 text-slate-700 ring-slate-300"
};

export type StatusFilter = "All" | keyof typeof statusStyles;

export function toInputDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromInputDate(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function moneyValue(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function toExportRow(tender: Tender) {
  return {
    "Tender Name": tender.tenderName,
    Authority: tender.authority,
    "Tender ID": tender.tenderId,
    "Last Date": tender.lastDate,
    "Pre-bid Date": tender.preBidDate,
    "Open Date": tender.openDate,
    "Days Left": daysLeft(tender.lastDate) ?? "",
    Status: getTenderStatus(tender.lastDate),
    EMD: tender.emd,
    "Tender Fee": tender.tenderFee,
    "Estimated Cost": tender.estimatedCost,
    "Bid Validity": tender.bidValidity,
    "Work Completion Period": tender.workCompletionPeriod,
    "Portal Name": tender.portalName,
    "Selection Method": tender.selectionMethod,
    "Similar Work Criteria": tender.similarWorkCriteria,
    "Technical Eligibility": tender.technicalEligibility,
    "Financial Eligibility": tender.financialEligibility,
    "Required Key Personnel": tender.requiredKeyPersonnel,
    "Required Machinery": tender.requiredMachinery,
    "Physical Document Submission": tender.physicalDocumentSubmission,
    "Documents Required": tender.documentsRequired,
    "Work Location": tender.workLocation,
    "Client Department": tender.clientDepartment
  };
}

export function valueOf(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? row[key.toLowerCase()] ?? "").trim();
}

