import { createWorker } from "tesseract.js";

type Progress = (message: string) => void;

type PdfJs = typeof import("pdfjs-dist");

const maxOcrPages = 20;
let workerReady = false;

async function loadPdfJs(): Promise<PdfJs> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

async function createOcrWorker(progress: Progress) {
  progress("Starting OCR engine...");
  const worker = await createWorker("eng", 1, {
    logger: (event) => {
      if (event.status === "recognizing text") {
        progress(`OCR ${Math.round((event.progress ?? 0) * 100)}%`);
      }
    }
  });
  workerReady = true;
  return worker;
}

export async function extractPdfTextInBrowser(file: File, progress: Progress) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
  const textPages: string[] = [];

  progress(`Reading ${document.numPages} PDF page${document.numPages === 1 ? "" : "s"}...`);

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) textPages.push(pageText);
  }

  const textLayer = textPages.join("\n\n");
  if (textLayer.trim().length >= 120) {
    progress("PDF text layer found.");
    return textLayer;
  }

  progress("PDF looks scanned. Running OCR...");
  const worker = await createOcrWorker(progress);
  const ocrPages: string[] = [];
  const pagesToRead = Math.min(document.numPages, maxOcrPages);

  try {
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      progress(`Rendering scanned page ${pageNumber} of ${pagesToRead}...`);
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) continue;

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      progress(`Reading scanned page ${pageNumber} of ${pagesToRead}...`);
      const result = await worker.recognize(canvas);
      if (result.data.text.trim()) ocrPages.push(result.data.text.trim());
    }
  } finally {
    if (workerReady) {
      await worker.terminate();
      workerReady = false;
    }
  }

  if (document.numPages > maxOcrPages) {
    progress(`OCR read first ${maxOcrPages} pages. Add missing fields manually if they appear later.`);
  }

  return ocrPages.join("\n\n");
}
