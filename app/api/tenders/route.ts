import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { createTender, listTenders } from "@/lib/tender-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return noStoreJson({ tenders: await listTenders() });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await createTender(await request.json());
    return noStoreJson(result, { status: 201 });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 400 });
  }
}
