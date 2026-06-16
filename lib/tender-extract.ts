import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { createRequire } from "module";
import { promisify } from "util";
import type { ExtractionConfidence, TenderExtraction, TenderFieldDebug, TenderInputKey } from "@/lib/tender-types";
import { normalizeDate, normalizeTenderInput } from "@/lib/tender-types";

const execFileAsync = promisify(execFile);
const nodeRequire = createRequire(import.meta.url);

type FieldKey = Exclude<TenderInputKey, "sourceFileName" | "rawText">;
type SmartFieldKey =
  | "tenderName"
  | "authority"
  | "openDate"
  | "lastDate"
  | "preBidDate"
  | "tenderId"
  | "emd"
  | "tenderFee"
  | "estimatedCost"
  | "bidValidity"
  | "workCompletionPeriod"
  | "portalName";
type ValueType = "text" | "authority" | "date" | "money" | "id" | "duration" | "portal";

type NormalizedLine = {
  index: number;
  text: string;
  comparable: string;
};

type Candidate = {
  field: SmartFieldKey;
  value: string;
  score: number;
  sourceLineNumber: number | null;
  sourceLineText: string;
  matchedKeyword: string;
  debugSource: string;
  source: "same-line" | "next-line" | "previous-line" | "table" | "inference" | "fallback";
};

const fieldKeys: FieldKey[] = [
  "tenderName",
  "authority",
  "openDate",
  "lastDate",
  "preBidDate",
  "tenderId",
  "emd",
  "tenderFee",
  "estimatedCost",
  "bidValidity",
  "workCompletionPeriod",
  "portalName",
  "selectionMethod",
  "similarWorkCriteria",
  "technicalEligibility",
  "financialEligibility",
  "requiredKeyPersonnel",
  "requiredMachinery",
  "physicalDocumentSubmission",
  "documentsRequired",
  "workLocation",
  "clientDepartment"
];

const smartFieldKeys: SmartFieldKey[] = [
  "tenderName",
  "authority",
  "openDate",
  "lastDate",
  "preBidDate",
  "tenderId",
  "emd",
  "tenderFee",
  "estimatedCost",
  "bidValidity",
  "workCompletionPeriod",
  "portalName"
];

const emptyExtraction: Record<FieldKey, string> = {
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

const specs: Record<SmartFieldKey, { type: ValueType; keywords: string[]; weakKeywords?: string[] }> = {
  tenderName: {
    type: "text",
    keywords: ["name of work", "tender name", "tender title", "work name", "description of work", "title of work"],
    weakKeywords: ["work of", "notice inviting tender", "request for proposal"]
  },
  authority: {
    type: "authority",
    keywords: ["authority", "department", "employer", "client", "organization", "organisation", "office name", "ministry", "name of organisation"],
    weakKeywords: ["government of", "board", "department", "authority"]
  },
  openDate: {
    type: "date",
    keywords: ["bid opening", "technical bid opening", "opening date", "date of opening", "opening of bid", "opening of tender"]
  },
  lastDate: {
    type: "date",
    keywords: [
      "bid submission closing",
      "bid submission end",
      "last date of submission",
      "submission closing",
      "closing date",
      "document download end date",
      "last date",
      "due date",
      "submission deadline"
    ]
  },
  preBidDate: {
    type: "date",
    keywords: ["pre-bid", "pre bid meeting", "pre-bid meeting", "pre bid conference", "prebid"]
  },
  tenderId: {
    type: "id",
    keywords: ["tender id", "tender reference number", "tender reference no", "nit no", "niq no", "bid number", "bid no", "tender number", "tender no"]
  },
  emd: {
    type: "money",
    keywords: ["earnest money deposit", "earnest money", "bid security", "emd amount", "emd"]
  },
  tenderFee: {
    type: "money",
    keywords: ["cost of tender document", "cost of bid document", "tender fee", "document fee", "document cost", "bid document fee", "form fee"]
  },
  estimatedCost: {
    type: "money",
    keywords: ["estimated cost", "estimated amount", "tender value", "estimated value", "value of work", "cost put to tender", "project cost", "pac"]
  },
  bidValidity: {
    type: "duration",
    keywords: ["bids shall remain valid", "bid validity", "validity period", "validity of bid", "offer validity"]
  },
  workCompletionPeriod: {
    type: "duration",
    keywords: ["completion period", "time allowed", "work completion", "period of completion", "time for completion", "contract period", "duration"]
  },
  portalName: {
    type: "portal",
    keywords: ["portal name", "e-procurement portal", "eprocurement portal", "portal", "website"]
  }
};

const dateRegex = /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{2,4})(?:\s+(?:up\s*to\s*)?\d{1,2}(?::|\.)\d{2}\s*(?:am|pm|hrs?|hours?)?)?\b/gi;
const moneyRegex = /\b(?:(?:rs\.?|inr|\u20b9)\s*(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?(?:\s*\/-)?|(?:\d{1,3}(?:,\d{2,3})+)(?:\.\d+)?(?:\s*\/-)?|(?:\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|crore|cr)\b)(?:\s*only)?\b|\b(?:nil|n\.?a\.?|not applicable|exempted)\b/gi;
const tenderIdRegex = /\b(?:GEM\/\d{4}\/B\/\d+|[A-Z]{2,}[A-Z0-9]*(?:[\/_.-][A-Z0-9]+){1,}|[A-Z0-9]{3,}\/[A-Z0-9/_.-]{3,})\b/gi;
const durationRegex = /\b(?:\d+\s*(?:days?|months?|years?|weeks?)|\d+\s*\([^)]+\)\s*(?:days?|months?|years?|weeks?))\b/gi;
const badAuthorityRegex = /\b(?:cpwd\s+standard|standard\s+cpwd|wbf\s*\d+|form\s+no|contract\s+form|general\s+conditions|special\s+conditions|clause|schedule\s+of\s+quantities)\b/i;
const badValueRegex = /^(?:-|--|:|n\/?a|date|amount|fee|details?|description|value|page\s*\d+|sl\.?\s*no\.?)$/i;
const serialLikeRegex = /^(?:\d{1,3}|[0-9]+(?:\([ivxlcdm]+\)|\.[0-9]+)+|[0-9]+[a-z]?)$/i;
const standardTemplateTitle = "TENDER TRACKER STANDARD TEMPLATE";
const templateDebugSource = "Tender Tracker Standard Template";

const templateLabels: Record<FieldKey, string> = {
  tenderName: "TT_TENDER_NAME",
  authority: "TT_AUTHORITY",
  openDate: "TT_OPEN_DATE",
  lastDate: "TT_LAST_DATE",
  preBidDate: "TT_PRE_BID_DATE",
  tenderId: "TT_TENDER_ID",
  emd: "TT_EMD",
  tenderFee: "TT_TENDER_FEE",
  estimatedCost: "TT_ESTIMATED_COST",
  bidValidity: "TT_BID_VALIDITY",
  workCompletionPeriod: "TT_WORK_COMPLETION_PERIOD",
  portalName: "TT_PORTAL_NAME",
  selectionMethod: "TT_SELECTION_METHOD",
  similarWorkCriteria: "TT_SIMILAR_WORK_CRITERIA",
  technicalEligibility: "TT_TECHNICAL_ELIGIBILITY",
  financialEligibility: "TT_FINANCIAL_ELIGIBILITY",
  requiredKeyPersonnel: "TT_REQUIRED_KEY_PERSONNEL",
  requiredMachinery: "TT_REQUIRED_MACHINERY",
  physicalDocumentSubmission: "TT_PHYSICAL_DOCUMENT_SUBMISSION",
  documentsRequired: "TT_DOCUMENTS_REQUIRED",
  workLocation: "TT_WORK_LOCATION",
  clientDepartment: "TT_CLIENT_DEPARTMENT"
};

export async function extractTenderFromPdf(buffer: Buffer, fileName: string): Promise<TenderExtraction> {
  const notes: string[] = [];
  let text = await extractPdfText(buffer);

  if (text.trim().length < 80) {
    notes.push("PDF text layer was sparse; attempted OCR fallback using local OCR tools.");
    const ocrText = await tryOcrFallback(buffer);
    if (ocrText.trim().length > text.trim().length) {
      text = ocrText;
      notes.push("OCR fallback produced readable text.");
    } else {
      notes.push("OCR fallback did not produce text. Browser OCR can still process scanned PDFs.");
    }
  }

  return extractTenderFromText(text, fileName, notes);
}

export function extractTenderFromText(text: string, fileName: string, notes: string[] = []): TenderExtraction {
  const template = extractTenderTrackerTemplate(text, fileName, notes);
  if (template) return template;

  const lines = normalizeLines(text);
  const candidates = [
    ...extractTableCandidates(lines),
    ...extractLabelCandidates(lines),
    ...extractInferenceCandidates(lines)
  ];
  const selected = selectBestCandidates(candidates);
  const values = { ...emptyExtraction };
  const debug: Partial<Record<TenderInputKey, TenderFieldDebug>> = {};

  for (const key of smartFieldKeys) {
    const candidate = selected[key];
    if (!candidate) continue;

    const confidence = confidenceFor(candidate.score);
    debug[key] = {
      value: candidate.value,
      confidence,
      sourceLineNumber: candidate.sourceLineNumber,
      sourceLineText: candidate.sourceLineText,
      matchedKeyword: candidate.matchedKeyword,
      source: candidate.debugSource
    };

    if (confidence !== "low") {
      values[key] = candidate.value;
    }
  }

  values.openDate = normalizeDate(values.openDate);
  values.lastDate = normalizeDate(values.lastDate);
  values.preBidDate = normalizeDate(values.preBidDate);

  const filled = Object.values(values).filter(Boolean).length;
  return {
    ...normalizeTenderInput({
      ...values,
      sourceFileName: fileName,
      rawText: text.slice(0, 40_000)
    }),
    confidence: filled >= 8 ? "high" : filled >= 4 ? "medium" : "low",
    extractionNotes: notes,
    extractionDebug: debug
  };
}

export function extractTenderTrackerTemplate(text: string, fileName: string, notes: string[] = []): TenderExtraction | null {
  if (!isTenderTrackerTemplate(text)) return null;

  const lines = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line, index) => ({ index, text: cleanLine(line) }))
    .filter((line) => line.text.length > 0);

  const values = { ...emptyExtraction };
  const debug: Partial<Record<TenderInputKey, TenderFieldDebug>> = {};
  const templateNotes = [...notes, "Standard Tender Tracker template detected. Fields extracted exactly."];
  const block = selectBestTemplateBlock(parseTemplateBlocksFromText(text, lines));

  for (const key of fieldKeys) {
    const label = templateLabels[key];
    const match = block.get(label) ?? findExactTemplateLine(lines, label);
    if (!match) continue;

    const value = normalizeTemplateValue(key, match.value);
    values[key] = value;
    debug[key] = {
      value,
      confidence: "high",
      sourceLineNumber: match.lineNumber,
      sourceLineText: match.lineText,
      matchedKeyword: label,
      source: templateDebugSource
    };
  }

  const filled = Object.values(values).filter(Boolean).length;
  return {
    ...normalizeTenderInput({
      ...values,
      sourceFileName: fileName,
      rawText: text.slice(0, 40_000)
    }),
    confidence: filled > 0 ? "high" : "low",
    extractionNotes: templateNotes,
    extractionDebug: debug
  };
}

function parseTemplateBlocks(lines: Array<{ index: number; text: string }>) {
  const blocks: Array<Map<string, { value: string; lineNumber: number; lineText: string }>> = [];
  let current: Map<string, { value: string; lineNumber: number; lineText: string }> | null = null;
  let activeLabel = "";
  let activeTarget: Map<string, { value: string; lineNumber: number; lineText: string }> | null = null;

  for (const line of lines) {
    if (/^TT_START\b/i.test(line.text)) {
      current = new Map();
      blocks.push(current);
      activeLabel = "";
      activeTarget = current;
      continue;
    }

    if (/^TT_END\b/i.test(line.text)) {
      current = null;
      activeLabel = "";
      activeTarget = null;
      continue;
    }

    const target = current ?? (blocks[0] ?? new Map());
    if (!current && blocks.length === 0) blocks.push(target);

    const labelMatch = line.text.match(/^\s*(TT_[A-Z_]+)\s*(?::|=|\|)\s*(.*)$/i);
    if (labelMatch) {
      activeLabel = labelMatch[1].toUpperCase();
      activeTarget = target;
      target.set(activeLabel, {
        value: labelMatch[2] ?? "",
        lineNumber: line.index + 1,
        lineText: line.text
      });
      continue;
    }

    if (activeTarget && activeLabel && !/^TT_[A-Z_]+/i.test(line.text)) {
      const existing = activeTarget.get(activeLabel);
      if (existing) {
        activeTarget.set(activeLabel, {
          ...existing,
          value: [existing.value, line.text].filter(Boolean).join(" "),
          lineText: [existing.lineText, line.text].filter(Boolean).join(" | ")
        });
      }
    }
  }

  return blocks;
}

function parseTemplateBlocksFromText(text: string, lines: Array<{ index: number; text: string }>) {
  const textBlocks = Array.from(text.matchAll(/TT_START([\s\S]*?)TT_END/gi)).map((match) => match[1] ?? "");
  if (textBlocks.length === 0) {
    const rawBlock = parseTemplateBlockFromRawText(text, lines);
    const lineBlocks = parseTemplateBlocks(lines);
    return [rawBlock, ...lineBlocks].filter((block) => block.size > 0);
  }

  return textBlocks.map((blockText) => {
    const block = new Map<string, { value: string; lineNumber: number | null; lineText: string }>();
    for (const key of fieldKeys) {
      const label = templateLabels[key];
      const value = extractTemplateLabelValue(blockText, label);
      if (value === null) continue;
      const source = findExactTemplateLine(lines, label);
      block.set(label, {
        value,
        lineNumber: source?.lineNumber ?? null,
        lineText: source?.lineText ?? `${label}=${value}`
      });
    }
    return block;
  });
}

function extractTemplateLabelValue(blockText: string, label: string) {
  const labels = Object.values(templateLabels).map(escapeRegExp).join("|");
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*(?::|=|\\|)\\s*([\\s\\S]*?)(?=\\b(?:${labels})\\s*(?::|=|\\|)|$)`, "i");
  const match = blockText.match(pattern);
  return match ? sanitizeExtractedValue(match[1] ?? "") : null;
}

function parseTemplateBlockFromRawText(text: string, lines: Array<{ index: number; text: string }>) {
  const block = new Map<string, { value: string; lineNumber: number | null; lineText: string }>();
  for (const key of fieldKeys) {
    const label = templateLabels[key];
    const value = extractTemplateLabelValue(text, label);
    if (value === null) continue;
    const source = findExactTemplateLine(lines, label) ?? findTemplateSourceInRawText(text, label, value);
    block.set(label, {
      value,
      lineNumber: source?.lineNumber ?? null,
      lineText: source?.lineText ?? `${label}: ${value}`
    });
  }
  return block;
}

function findTemplateSourceInRawText(text: string, label: string, value: string) {
  const index = text.search(new RegExp(escapeRegExp(label), "i"));
  if (index < 0) return null;
  const prefix = text.slice(0, index);
  const lineNumber = prefix.split(/\r?\n/).length;
  return {
    lineNumber,
    lineText: `${label}: ${sanitizeExtractedValue(value).slice(0, 180)}`
  };
}

function selectBestTemplateBlock(blocks: Array<Map<string, { value: string; lineNumber: number | null; lineText: string }>>) {
  return (
    blocks
      .map((block) => ({
        block,
        filled: Array.from(block.values()).filter((entry) => !isBlankTemplateValue(entry.value)).length
      }))
      .sort((left, right) => right.filled - left.filled)[0]?.block ?? new Map()
  );
}

async function extractPdfText(buffer: Buffer) {
  const pdfJsText = await extractPdfTextWithPdfJs(buffer);
  if (pdfJsText.trim().length >= 40) return pdfJsText;

  try {
    const { PDFParse } = nodeRequire("pdf-parse") as typeof import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    return "";
  }
}

async function extractPdfTextWithPdfJs(buffer: Buffer) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true } as Parameters<typeof pdfjs.getDocument>[0]).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }

    return pages.join("\n");
  } catch {
    return "";
  }
}

async function tryOcrFallback(buffer: Buffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tender-ocr-"));
  const pdfPath = path.join(dir, "source.pdf");
  const imagePrefix = path.join(dir, "page");
  try {
    await fs.writeFile(pdfPath, buffer);
    await execFileAsync("pdftoppm", ["-png", "-f", "1", "-l", "3", "-r", "180", pdfPath, imagePrefix], { timeout: 60_000 });
    const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".png")).slice(0, 3);
    const pages = await Promise.all(
      files.map(async (file) => {
        const imagePath = path.join(dir, file);
        const outputBase = imagePath.replace(/\.png$/i, "");
        await execFileAsync("tesseract", [imagePath, outputBase, "-l", "eng"], { timeout: 60_000 });
        return fs.readFile(`${outputBase}.txt`, "utf8");
      })
    );
    return pages.join("\n");
  } catch {
    return "";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function normalizeLines(text: string): NormalizedLine[] {
  return text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line, index) => ({
      index,
      text: cleanLine(line),
      comparable: normalizeComparable(line)
    }))
    .filter((line) => line.text.length > 0 && !/^page\s+\d+\s*(?:of\s+\d+)?$/i.test(line.text));
}

function isTenderTrackerTemplate(text: string) {
  if (new RegExp(standardTemplateTitle, "i").test(text)) return true;
  return Object.values(templateLabels).some((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, "i").test(text));
}

function findExactTemplateLine(lines: Array<{ index: number; text: string }>, label: string) {
  const escaped = escapeRegExp(label);
  const pattern = new RegExp(`^\\s*${escaped}\\s*(?::|=|\\|)\\s*(.*)$`, "i");

  for (const line of lines) {
    const match = line.text.match(pattern);
    if (!match) continue;
    return {
      value: match[1] ?? "",
      lineNumber: line.index + 1,
      lineText: line.text
    };
  }

  return null;
}

function normalizeTemplateValue(key: FieldKey, value: string) {
  const cleaned = sanitizeExtractedValue(value);
  if (isBlankTemplateValue(cleaned)) return "";
  if (key === "openDate" || key === "lastDate" || key === "preBidDate") return normalizeTemplateDate(cleaned);
  if (key === "emd" || key === "tenderFee" || key === "estimatedCost") return normalizeTemplateAmount(cleaned);
  return cleaned;
}

function normalizeTemplateDate(value: string) {
  const cleaned = sanitizeExtractedValue(value);
  const dateOnly = parseDateOnlyParts(cleaned);
  if (dateOnly) {
    const { day, month, year } = dateOnly;
    return `${year}-${pad2(month)}-${pad2(day)}T12:00:00.000Z`;
  }
  return normalizeDate(cleaned);
}

function parseDateOnlyParts(value: string) {
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3])
    };
  }

  const date = value.match(
    /^(\d{1,2})[-/.\s](\d{1,2}|jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[-/.\s](\d{2,4})$/i
  );
  if (!date) return null;

  return {
    day: Number(date[1]),
    month: parseTemplateMonth(date[2]),
    year: Number(date[3].length === 2 ? `20${date[3]}` : date[3])
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseTemplateMonth(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return Math.max(1, months.indexOf(value.toLowerCase().slice(0, 3)) + 1);
}

function normalizeTemplateAmount(value: string) {
  const cleaned = sanitizeExtractedValue(value);
  if (/^(?:nil|n\.?a\.?|not applicable|exempted)$/i.test(cleaned)) return "";
  return cleaned.replace(/[^\d.]/g, "");
}

function isBlankTemplateValue(value: string) {
  const cleaned = sanitizeExtractedValue(value);
  return !cleaned || /^(?:not available|na|n\/a|null|none|-|--|blank)$/i.test(cleaned);
}

function extractLabelCandidates(lines: NormalizedLine[]) {
  const candidates: Candidate[] = [];

  for (const field of smartFieldKeys) {
    const spec = specs[field];
    for (const line of lines) {
      const keyword = matchingKeyword(line, spec.keywords);
      if (!keyword) continue;

      const sameLineText = textAfterKeyword(line.text, keyword) || line.text;
      addCandidatesFromText(candidates, field, sameLineText, line, keyword, 130, "same-line");

      for (let offset = 1; offset <= 3; offset += 1) {
        const nearby = lines.find((candidateLine) => candidateLine.index === line.index + offset);
        if (!nearby || hasAnyFieldKeyword(nearby)) break;
        addCandidatesFromText(candidates, field, nearby.text, nearby, keyword, 105 - offset * 12, "next-line");
      }

      for (let offset = 1; offset <= 2; offset += 1) {
        const nearby = lines.find((candidateLine) => candidateLine.index === line.index - offset);
        if (!nearby || hasAnyFieldKeyword(nearby)) break;
        addCandidatesFromText(candidates, field, nearby.text, nearby, keyword, 78 - offset * 10, "previous-line");
      }
    }
  }

  return candidates;
}

function extractTableCandidates(lines: NormalizedLine[]) {
  const candidates: Candidate[] = [];
  const tableFields: SmartFieldKey[] = ["estimatedCost", "emd", "tenderFee", "lastDate", "preBidDate", "openDate", "tenderId"];

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const headerBlock = lines.slice(cursor, cursor + 4);
    const columns = tableFields
      .map((field) => ({ field, line: headerBlock.find((line) => matchingKeyword(line, specs[field].keywords)) }))
      .filter((column): column is { field: SmartFieldKey; line: NormalizedLine } => Boolean(column.line))
      .sort((left, right) => left.line.index - right.line.index || labelPosition(left.line, specs[left.field].keywords) - labelPosition(right.line, specs[right.field].keywords));

    if (columns.length < 2) continue;

    const valueLines = lines.slice(cursor + headerBlock.length, cursor + headerBlock.length + 8).filter((line) => !hasAnyFieldKeyword(line));
    if (valueLines.length === 0) continue;

    const joinedValues = valueLines.map((line) => line.text).join(" ");
    const moneyValues = matchesWithIndex(joinedValues, moneyRegex).filter((match) => validValueForType("money", match.value));
    const dateValues = matchesWithIndex(joinedValues, dateRegex).filter((match) => validValueForType("date", match.value));
    const idValues = matchesWithIndex(joinedValues, tenderIdRegex).filter((match) => validValueForType("id", match.value));

    const valuesByType = {
      money: moneyValues,
      date: dateValues,
      id: idValues
    };

    for (const column of columns) {
      const spec = specs[column.field];
      const type = spec.type === "money" || spec.type === "date" || spec.type === "id" ? spec.type : null;
      if (!type) continue;

      const sameTypeColumns = columns.filter((item) => specs[item.field].type === type);
      const ordinal = sameTypeColumns.findIndex((item) => item.field === column.field);
      const match = valuesByType[type][ordinal];
      if (!match) continue;

      candidates.push({
        field: column.field,
        value: match.value,
        score: 116,
        sourceLineNumber: valueLines[0]?.index + 1,
        sourceLineText: valueLines.slice(0, 3).map((line) => line.text).join(" | "),
        matchedKeyword: matchingKeyword(column.line, spec.keywords) ?? spec.keywords[0],
        debugSource: "Smart tender table mapping",
        source: "table"
      });
    }
  }

  return candidates;
}

function extractInferenceCandidates(lines: NormalizedLine[]) {
  const candidates: Candidate[] = [];
  const allText = lines.map((line) => line.text).join(" ");

  const portal = inferPortalName(allText);
  if (portal) {
    candidates.push({
      field: "portalName",
      value: portal,
      score: 105,
      sourceLineNumber: null,
      sourceLineText: "Inferred from portal URL or portal-specific tender ID.",
      matchedKeyword: portal,
      debugSource: "Smart tender inference",
      source: "inference"
    });
  }

  const tenderNameLine = lines.find((line) => /(?:work of|survey|construction|civil|road|building|tender|rfp|nit)/i.test(line.text) && line.text.length > 20 && line.text.length < 220);
  if (tenderNameLine) {
    candidates.push({
      field: "tenderName",
      value: cleanValue(tenderNameLine.text),
      score: 72,
      sourceLineNumber: tenderNameLine.index + 1,
      sourceLineText: tenderNameLine.text,
      matchedKeyword: "work/tender phrase",
      debugSource: "Smart tender inference",
      source: "inference"
    });
  }

  const authorityLine = lines.find((line) => isAuthorityValue(line.text));
  if (authorityLine) {
    candidates.push({
      field: "authority",
      value: cleanValue(authorityLine.text),
      score: 76,
      sourceLineNumber: authorityLine.index + 1,
      sourceLineText: authorityLine.text,
      matchedKeyword: "government authority phrase",
      debugSource: "Smart tender inference",
      source: "inference"
    });
  }

  const gemId = allText.match(/\bGEM\/\d{4}\/B\/\d+\b/i)?.[0];
  if (gemId) {
    candidates.push({
      field: "tenderId",
      value: gemId,
      score: 96,
      sourceLineNumber: null,
      sourceLineText: "Matched GeM bid number in extracted text.",
      matchedKeyword: "GeM bid number",
      debugSource: "Smart tender inference",
      source: "inference"
    });
  }

  return candidates;
}

function addCandidatesFromText(
  candidates: Candidate[],
  field: SmartFieldKey,
  text: string,
  line: NormalizedLine,
  keyword: string,
  baseScore: number,
  source: Candidate["source"]
) {
  const spec = specs[field];
  const values = extractValuesForType(spec.type, text);

  for (const value of values) {
    if (!validValueForType(spec.type, value)) continue;
    candidates.push({
      field,
      value,
      score: baseScore + keywordStrength(keyword) + valueStrength(spec.type, value),
      sourceLineNumber: line.index + 1,
      sourceLineText: line.text,
      matchedKeyword: keyword,
      debugSource: "Smart tender keyword extraction",
      source
    });
  }
}

function extractValuesForType(type: ValueType, text: string) {
  if (type === "date") return matchesWithIndex(text, dateRegex).map((match) => match.value);
  if (type === "money") return matchesWithIndex(text, moneyRegex).map((match) => match.value);
  if (type === "id") return matchesWithIndex(text, tenderIdRegex).map((match) => match.value);
  if (type === "duration") return matchesWithIndex(text, durationRegex).map((match) => match.value);
  if (type === "portal") {
    const inferred = inferPortalName(text);
    return inferred ? [inferred] : [stripLabelNoise(text)];
  }
  if (type === "authority") return [stripLabelNoise(text)];
  return [stripLabelNoise(text)];
}

function selectBestCandidates(candidates: Candidate[]) {
  const selected: Partial<Record<SmartFieldKey, Candidate>> = {};
  for (const field of smartFieldKeys) {
    const best = candidates
      .filter((candidate) => candidate.field === field && validValueForType(specs[field].type, candidate.value))
      .sort((left, right) => right.score - left.score || sourceRank(right.source) - sourceRank(left.source))[0];
    if (best) selected[field] = best;
  }
  return selected;
}

function confidenceFor(score: number): ExtractionConfidence {
  if (score >= 100) return "high";
  if (score >= 72) return "medium";
  return "low";
}

function validValueForType(type: ValueType, value: string) {
  const cleaned = sanitizeExtractedValue(value);
  if (!cleaned || badValueRegex.test(cleaned) || serialLikeRegex.test(cleaned)) return false;
  if (type === "money") return moneyValueLooksValid(cleaned);
  if (type === "date") return dateValueLooksValid(cleaned);
  if (type === "id") return tenderIdLooksValid(cleaned);
  if (type === "authority") return isAuthorityValue(cleaned);
  if (type === "text") return cleaned.length >= 8 && cleaned.length <= 260 && !badAuthorityRegex.test(cleaned);
  if (type === "duration") return /\b(?:days?|months?|years?|weeks?)\b/i.test(cleaned);
  return cleaned.length >= 2;
}

function moneyValueLooksValid(value: string) {
  return /(?:rs\.?|inr|\u20b9|lakh|lac|crore|cr|,|nil|not applicable|exempted)/i.test(value) && !serialLikeRegex.test(value);
}

function dateValueLooksValid(value: string) {
  return dateRegex.test(value) && !/\b(?:page|clause|section)\b/i.test(value);
}

function tenderIdLooksValid(value: string) {
  if (serialLikeRegex.test(value) || /\b(?:wbf|cpwd|page|clause|section)\b/i.test(value)) return false;
  return /[A-Z]/i.test(value) && /[0-9/_.-]/.test(value) && value.length >= 5;
}

function isAuthorityValue(value: string) {
  const cleaned = cleanValue(value);
  if (cleaned.length < 6 || badAuthorityRegex.test(cleaned)) return false;
  return /\b(?:board|department|ministry|authority|municipal|corporation|pwd|nhai|railway|irrigation|government|nagar|parishad|panchayat|river|jal|nigam)\b/i.test(cleaned);
}

function matchingKeyword(line: NormalizedLine, keywords: string[]) {
  return keywords.find((keyword) => line.comparable.includes(normalizeComparable(keyword))) ?? "";
}

function hasAnyFieldKeyword(line: NormalizedLine) {
  return smartFieldKeys.some((field) => Boolean(matchingKeyword(line, specs[field].keywords)));
}

function textAfterKeyword(text: string, keyword: string) {
  const regex = new RegExp(`${escapeRegExp(keyword).replace(/\\ /g, "\\s+")}\\s*[:\\-–—]?\\s*(.*)$`, "i");
  return text.match(regex)?.[1]?.trim() ?? "";
}

function labelPosition(line: NormalizedLine, keywords: string[]) {
  const positions = keywords.map((keyword) => line.comparable.indexOf(normalizeComparable(keyword))).filter((position) => position >= 0);
  return positions.length > 0 ? Math.min(...positions) : 9999;
}

function keywordStrength(keyword: string) {
  if (keyword.length >= 22) return 18;
  if (keyword.length >= 12) return 10;
  return 3;
}

function valueStrength(type: ValueType, value: string) {
  if (type === "money") {
    let score = 0;
    if (/(?:rs\.?|inr|\u20b9)/i.test(value)) score += 20;
    if (/,/.test(value)) score += 12;
    if (/\b(?:lakh|lac|crore|cr)\b/i.test(value)) score += 10;
    return score;
  }
  if (type === "date" && /\d{1,2}(?::|\.)\d{2}/.test(value)) return 8;
  return 0;
}

function sourceRank(source: Candidate["source"]) {
  return { "same-line": 6, table: 5, "next-line": 4, "previous-line": 3, inference: 2, fallback: 1 }[source];
}

function matchesWithIndex(text: string, regex: RegExp) {
  regex.lastIndex = 0;
  return Array.from(text.matchAll(regex)).map((match) => ({
    value: sanitizeExtractedValue(match[0]),
    index: match.index ?? 0
  }));
}

function inferPortalName(text: string) {
  if (/gem\.gov\.in|GEM\/\d{4}\/B\//i.test(text)) return "GeM";
  if (/eprocure\.gov\.in|central public procurement|cppp/i.test(text)) return "CPPP";
  if (/mptenders|eprocurement system|e[-\s]?procurement/i.test(text)) return "eProcurement";
  return "";
}

function cleanLine(value: string) {
  return value.replace(/[|]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanValue(value: string) {
  return sanitizeExtractedValue(value).slice(0, 260);
}

function stripLabelNoise(value: string) {
  const cleaned = sanitizeExtractedValue(value);
  const parts = cleaned.split(/\s{2,}|[:\-–—]\s*/).map((part) => sanitizeExtractedValue(part)).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : cleaned;
}

function sanitizeExtractedValue(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/^(?:rs\.?|inr)\s*/i, "Rs. ")
    .replace(/\s+/g, " ")
    .replace(/^[:\-\s.()]+/, "")
    .replace(/[;,]+$/, "")
    .trim();
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
