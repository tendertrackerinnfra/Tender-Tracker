import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { markNotificationRead } from "@/lib/notification-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await markNotificationRead(id);
    return noStoreJson({ ok: true });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 400 });
  }
}
