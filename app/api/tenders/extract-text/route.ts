import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { extractTenderFromText } from "@/lib/tender-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "uploaded.pdf";

    if (text.trim().length < 20) {
      return noStoreJson({ error: "OCR did not return enough text to extract tender fields." }, { status: 400 });
    }

    const extraction = extractTenderFromText(text, fileName, [
      "Browser PDF text extraction completed.",
      "Review all fields before adding the tender."
    ]);
    return noStoreJson({ extraction });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 500 });
  }
}
