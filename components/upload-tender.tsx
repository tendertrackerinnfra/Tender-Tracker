"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Loader2, Upload } from "lucide-react";
import type { ScheduledNotification, TenderExtraction, TenderFieldDebug, TenderInput, TenderInputKey } from "@/lib/tender-types";
import { normalizeTenderInput } from "@/lib/tender-types";
import { blankTender, formFields, fromInputDate, requiredPreviewFields, toInputDate } from "@/components/tender-ui";

export function UploadTender() {
  const router = useRouter();
  const [preview, setPreview] = useState<TenderInput | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ocrProgress, setOcrProgress] = useState("");
  const [rawPreviewText, setRawPreviewText] = useState("");
  const [extractionDebug, setExtractionDebug] = useState<Partial<Record<TenderInputKey, TenderFieldDebug>>>({});
  const tenderFileRef = useRef<HTMLInputElement>(null);
  const templateFileRef = useRef<HTMLInputElement>(null);

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
    <main className="min-h-screen bg-slate-50 pb-20 text-slate-950 md:pb-0">
      <UploadHeader />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Upload Tender</p>
            <h1 className="mt-1 text-2xl font-semibold">Extract tender details</h1>
          </div>
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </div>

        {message ? <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div> : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <UploadBox
            title="Upload RFP/NIT/Tender PDF"
            description="Use this for original government tender documents. Scanned PDFs use OCR fallback."
            buttonLabel="Select tender PDF"
            isExtracting={isExtracting}
            inputRef={tenderFileRef}
            onFile={extractPdf}
          />
          <UploadBox
            title="Upload ChatGPT TT_ Template PDF"
            description="Use this for the Standard Tender Tracker template. TT_ labels are parsed exactly."
            buttonLabel="Select TT_ template PDF"
            isExtracting={isExtracting}
            inputRef={templateFileRef}
            onFile={extractPdf}
          />
        </section>

        {ocrProgress ? <p className="text-sm font-medium text-emerald-800">{ocrProgress}</p> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Editable Preview</h2>
            {preview ? (
              <button onClick={clearPreview} className="text-sm font-semibold text-slate-500">
                Clear
              </button>
            ) : null}
          </div>

          {notes.length > 0 ? (
            <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {formFields.map((field) => {
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
                  : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100";

              return (
                <label key={field.key} className="grid gap-1 text-sm font-medium text-slate-700">
                  <span className="flex items-center justify-between gap-2">
                    {field.label}
                    {isBlankRequired ? (
                      <span className="text-xs font-semibold text-red-700">Required</span>
                    ) : debug ? (
                      <span className={debug.confidence === "high" ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-700"}>
                        {debug.confidence}
                      </span>
                    ) : null}
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
                    className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 ${inputTone}`}
                  />
                  {debug?.sourceLineText ? (
                    <span className="text-xs font-normal text-slate-500">
                      Line {debug.sourceLineNumber ?? "-"}: {debug.sourceLineText.slice(0, 120)}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={saveTender}
              disabled={!preview || isSaving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Add Tender
            </button>
            <button onClick={clearPreview} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
              Clear
            </button>
          </div>

          {rawPreviewText ? (
            <>
              <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">View extracted PDF text</summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{rawPreviewText}</pre>
              </details>
              <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">View extraction debug</summary>
                <div className="mt-3 max-h-72 overflow-auto">
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
      </div>
    </main>
  );
}

function UploadHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Civil Consultancy</p>
          <p className="mt-1 text-xl font-semibold">Tender Tracker</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/">Dashboard</Link>
          <Link className="rounded-md bg-slate-950 px-3 py-2 text-white" href="/upload">Upload Tender</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/calendar">Calendar</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/reports">Reports</Link>
          <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/settings">Settings</Link>
        </nav>
      </div>
    </header>
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
      className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-5"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-emerald-100 p-2 text-emerald-800">
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
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        disabled={isExtracting}
      >
        {isExtracting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        {isExtracting ? "Extracting details" : buttonLabel}
      </button>
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

