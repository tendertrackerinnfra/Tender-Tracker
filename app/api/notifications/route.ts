import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import {
  clearAllNotifications,
  createAppNotification,
  listAppNotifications,
  syncDerivedNotifications
} from "@/lib/notification-store";
import { listScheduledNotifications, listTenders, markScheduledNotificationsDelivered } from "@/lib/tender-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tenders = await listTenders();
    const scheduled = await listScheduledNotifications();
    await syncDerivedNotifications({ tenders, scheduledNotifications: scheduled });
    const dueIds = scheduled
      .filter((item) => !item.deliveredAt && new Date(item.notifyAt).getTime() <= Date.now())
      .map((item) => item.id);
    await markScheduledNotificationsDelivered(dueIds);

    const filter = (request.nextUrl.searchParams.get("filter") as "all" | "unread" | "important" | null) ?? "all";
    const notifications = await listAppNotifications(filter);
    return noStoreJson({ notifications });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const notification = await createAppNotification({
      type: body.type ?? "tenderUpdated",
      title: body.title ?? "Tender Tracker",
      body: body.body ?? "",
      url: body.url ?? "/",
      level: body.level ?? "info",
      isImportant: Boolean(body.isImportant),
      tenderId: body.tenderId
    });
    return noStoreJson({ notification }, { status: 201 });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    await clearAllNotifications();
    return noStoreJson({ ok: true });
  } catch (error) {
    return noStoreJson({ error: (error as Error).message }, { status: 500 });
  }
}
