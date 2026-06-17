import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/notification-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return noStoreJson({ settings: await getNotificationSettings() });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const settings = await updateNotificationSettings(await request.json());
    return noStoreJson({ settings });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 400 });
  }
}
