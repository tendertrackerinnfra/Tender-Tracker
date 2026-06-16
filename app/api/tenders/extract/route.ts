import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { extractTenderFromPdf } from "@/lib/tender-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return noStoreJson({ error: "Upload a PDF file." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return noStoreJson({ error: "Only PDF files are supported for extraction." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractTenderFromPdf(buffer, file.name);
    return noStoreJson({ extraction });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 500 });
  }
}
