import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { deleteTender, updateTender } from "@/lib/tender-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await updateTender(id, await request.json());
    return noStoreJson(result);
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteTender(id);
    return noStoreJson({ ok: true });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 400 });
  }
}
