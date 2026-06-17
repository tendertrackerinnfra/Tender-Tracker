"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { ScheduledNotification, TenderExtraction, TenderFieldDebug, TenderInput, TenderInputKey } from "@/lib/tender-types";
import { normalizeTenderInput } from "@/lib/tender-types";
import { blankTender, formFields, fromInputDate, requiredPreviewFields, toInputDate } from "@/components/tender-ui";

const fieldSections: Array<{
  title: string;
  description: string;
  fields: TenderInputKey[];
}> = [
  {
    title: "Basic Details",
    description: "Primary tender identity and portal reference.",
    fields: ["tenderName", "authority", "tenderId", "portalName"]
  },
  {
    title: "Key Dates",
    description: "Submission and meeting dates used for dashboard tracking.",
    fields: ["openDate", "lastDate", "preBidDate"]
  },
  {
    title: "Financial Details",
    description: "Bid values, fee details, and validity information.",
    fields: ["emd", "tenderFee", "estimatedCost", "bidValidity", "workCompletionPeriod"]
  },
  {
    title: "Eligibility Notes",
    description: "Selection criteria and technical or financial qualification notes.",
    fields: ["selectionMethod", "similarWorkCriteria", "technicalEligibility", "financialEligibility"]
  },
  {
    title: "Tender Requirements",
    description: "Documents, resources, and submission support details.",
    fields: [
      "requiredKeyPersonnel",
      "requiredMachinery",
      "physicalDocumentSubmission",
      "documentsRequired",
      "workLocation",
      "clientDepartment"
    ]
  }
];

export function UploadTender() {
  const router = useRouter();
  const [preview, setPreview] = useState<TenderInput | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [ocrProgress, setOcrProgress] = useState("");
  const [rawPreviewText, setRawPreviewText] = useState("");
  const [extractionDebug, setExtractionDebug] = useState<Partial<Record<TenderInputKey, TenderFieldDebug>>>({});
  const tenderFileRef = useRef<HTMLInputElement>(null);

  async function extractPdf(file: File) {
    setIsExtracting(true);
    setMessage("");
    setNotes([]);
    setOcrProgress("");
    setRawPreviewText("");
    setExtractionDebug({});
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/tenders/extract", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Extraction failed.");
      let extraction = data.extraction as TenderExtraction;

      if (shouldRunBrowserOcr(extraction)) {
        setOcrProgress("Starting scanned PDF OCR...");
        const { extractPdfTextInBrowser } = await import("@/lib/browser-pdf-ocr");
        const text = await extractPdfTextInBrowser(file, setOcrProgress);
        const ocrResponse = await fetch("/api/tenders/extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, text })
        });
        const ocrData = await ocrResponse.json();
        if (!ocrResponse.ok) throw new Error(ocrData.error ?? "OCR extraction failed.");
        extraction = ocrData.extraction as TenderExtraction;
      }

      setPreview(normalizeTenderInput(extraction));
      setRawPreviewText(extraction.rawText ?? "");
      setExtractionDebug(extraction.extractionDebug ?? {});
      const missingFields = requiredPreviewFields
        .filter((field) => !String(extraction[field.key] ?? "").trim())
        .map((field) => field.label);
      setNotes([
        `Extraction confidence: ${extraction.confidence}`,
        missingFields.length > 0 ? `Review missing fields: ${missingFields.join(", ")}` : "All required fields were detected.",
        ...extraction.extractionNotes
      ]);
      setOcrProgress("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsExtracting(false);
    }
  }

  async function saveTender() {
    if (!preview) return;
    setIsSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save tender.");
      scheduleBrowserNotifications(data.notifications ?? []);
      setMessage("Tender added and reminders scheduled. Returning to dashboard...");
      setToast("Tender saved successfully.");
      setTimeout(() => router.push("/"), 700);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function clearPreview() {
    setPreview(null);
    setNotes([]);
    setRawPreviewText("");
    setExtractionDebug({});
    setOcrProgress("");
    setMessage("");
  }

  return (
    <AppShell
      title="Upload Tender"
      kicker="Document extraction"
      actions={
        <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      }
    >
      <div className="space-y-5 pb-24 md:pb-6">
        {toast ? <SuccessToast message={toast} /> : null}
        {message ? <Banner message={message} /> : null}

        <section className="space-y-5">
          <UploadBox
            title="Upload Tender PDF"
            description="Upload original RFP/NIT/Tender PDF or ChatGPT TT_ Template PDF."
            buttonLabel="Select PDF"
            isExtracting={isExtracting}
            inputRef={tenderFileRef}
            onFile={extractPdf}
          />
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Upload ChatGPT TT_ Template PDF for exact field import.
          </div>
        </section>

        {isExtracting ? <ExtractionSkeleton /> : null}
        {ocrProgress ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{ocrProgress}</div> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Editable Preview</h2>
              <p className="mt-1 text-sm text-slate-500">Review required fields, key dates, and extraction confidence before adding the tender.</p>
            </div>
            {preview ? (
              <button onClick={clearPreview} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">
                <XCircle className="size-4" />
                Clear
              </button>
            ) : null}
          </div>

          {notes.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}

          <div className="mt-5 space-y-5">
            {fieldSections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">{section.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {section.fields.map((fieldKey) => {
                    const field = formFields.find((item) => item.key === fieldKey);
                    if (!field) return null;
                    const debug = extractionDebug[field.key];
                    const value = preview?.[field.key] ?? "";
                    const isRequired = requiredPreviewFields.some((required) => required.key === field.key);
                    const isBlankRequired = isRequired && !String(value).trim();
                    const isLowConfidence = debug?.confidence === "low";
                    const isMediumConfidence = debug?.confidence === "medium";
                    const inputTone = isBlankRequired
                      ? "border-red-400 bg-red-50 focus:border-red-600 focus:ring-red-100"
                      : isLowConfidence || isMediumConfidence
                        ? "border-amber-400 bg-amber-50 focus:border-amber-600 focus:ring-amber-100"
                        : "border-slate-300 bg-white focus:border-emerald-600 focus:ring-emerald-100";

                    return (
                      <label key={field.key} className="grid gap-1 text-sm font-medium text-slate-700">
                        <span className="flex items-center justify-between gap-2">
                          <span>{field.label}</span>
                          {isRequired ? (
                            <span className={isBlankRequired ? "text-xs font-semibold text-red-700" : "text-xs font-semibold text-slate-500"}>Required</span>
                          ) : (
                            <span className="text-xs text-slate-400">Optional</span>
                          )}
                        </span>
                        <input
                          value={field.type === "datetime-local" ? toInputDate(preview?.[field.key]) : preview?.[field.key] ?? ""}
                          onChange={(event) =>
                            setPreview((current) => ({
                              ...(current ?? blankTender),
                              [field.key]: field.type === "datetime-local" ? fromInputDate(event.target.value) : event.target.value
                            }))
                          }
                          type={field.type ?? "text"}
                          className={`rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputTone}`}
                        />
                        <span className="text-xs text-slate-500">
                          {debug?.sourceLineText
                            ? `Line ${debug.sourceLineNumber ?? "-"}: ${debug.sourceLineText.slice(0, 120)}`
                            : isRequired
                              ? "Required for tender import."
                              : "Optional field."}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {rawPreviewText ? (
            <>
              <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">View extracted PDF text</summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{rawPreviewText}</pre>
              </details>
              <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">View extraction debug</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Field</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2 pr-3">Confidence</th>
                        <th className="py-2 pr-3">Line</th>
                        <th className="py-2 pr-3">Keyword</th>
                        <th className="py-2 pr-3">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {formFields.map((field) => {
                        const debug = extractionDebug[field.key];
                        return (
                          <tr key={field.key}>
                            <td className="py-2 pr-3 font-semibold text-slate-700">{field.label}</td>
                            <td className="py-2 pr-3 text-slate-700">{debug?.value || "-"}</td>
                            <td className="py-2 pr-3 text-slate-700">{debug?.confidence || "blank"}</td>
                            <td className="py-2 pr-3 text-slate-700">{debug?.sourceLineNumber ?? "-"}</td>
                            <td className="py-2 pr-3 text-slate-700">{debug?.matchedKeyword || "-"}</td>
                            <td className="py-2 pr-3 text-slate-700">{debug?.source || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : null}
        </section>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl gap-2">
            <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
              Back
            </Link>
            <button onClick={clearPreview} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
              Clear
            </button>
            <button
              onClick={saveTender}
              disabled={!preview || isSaving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Add Tender
            </button>
          </div>
        </div>

        <div className="hidden md:flex md:justify-end md:gap-2">
          <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            Back to Dashboard
          </Link>
          <button onClick={clearPreview} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
            Clear
          </button>
          <button
            onClick={saveTender}
            disabled={!preview || isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Add Tender
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Banner({ message }: { message: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">{message}</div>;
}

function SuccessToast({ message }: { message: string }) {
  return (
    <div className="fixed right-4 top-20 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
      {message}
    </div>
  );
}

function UploadBox({
  title,
  description,
  buttonLabel,
  isExtracting,
  inputRef,
  onFile
}: {
  title: string;
  description: string;
  buttonLabel: string;
  isExtracting: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void | Promise<void>;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void onFile(file);
      }}
      className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800">
          <Upload className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.currentTarget.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
        disabled={isExtracting}
      >
        {isExtracting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        {isExtracting ? "Extracting details" : buttonLabel}
      </button>
    </div>
  );
}

function ExtractionSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="space-y-3">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function shouldRunBrowserOcr(extraction: TenderExtraction) {
  if (extraction.extractionNotes.some((note) => note.includes("Standard Tender Tracker template detected"))) {
    return false;
  }

  const filledFields = [
    extraction.tenderName,
    extraction.authority,
    extraction.lastDate,
    extraction.preBidDate,
    extraction.openDate,
    extraction.tenderId,
    extraction.emd,
    extraction.tenderFee,
    extraction.estimatedCost
  ].filter(Boolean).length;

  const rawTextLength = extraction.rawText?.trim().length ?? 0;
  const missingRequired = !extraction.tenderName || !extraction.authority || !extraction.lastDate;
  const missingScheduleValues = [extraction.lastDate, extraction.openDate, extraction.emd, extraction.tenderFee, extraction.estimatedCost].filter(Boolean).length < 2;
  return (extraction.confidence !== "high" && (missingRequired || missingScheduleValues)) || (filledFields < 3 || rawTextLength < 120);
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
