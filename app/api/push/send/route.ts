import { NextRequest } from "next/server";
import type { PushSubscription } from "web-push";
import { configureWebPush } from "@/lib/web-push";
import { getSupabaseAdmin } from "@/lib/supabase";
import { noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  const expectedApiKey = process.env.TENDER_TRACKER_API_KEY;
  const apiKey = request.headers.get("x-tender-tracker-api-key");
  if (!expectedApiKey || apiKey !== expectedApiKey) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    title,
    body,
    url = "/"
  } = await request.json();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return noStoreJson({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const { data, error } = await supabase.from("push_subscriptions").select("subscription");
  if (error) {
    await captureError(error, { route: "/api/push/send", phase: "load_subscriptions" });
    return noStoreJson({ error: error.message }, { status: 500 });
  }

  const webpush = configureWebPush();
  const payload = JSON.stringify({
    title: title ?? "Tender Tracker",
    body: body ?? "Tender reminder due.",
    url
  });
  const results = await Promise.allSettled(
    (data ?? []).map((row) => webpush.sendNotification(row.subscription as PushSubscription, payload))
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.filter((result) => result.status === "rejected").length;

  if (failed > 0) {
    await captureError(new Error("Some push notifications failed"), { route: "/api/push/send", sent, failed });
  }

  return noStoreJson({
    status: sent > 0 ? "sent" : data && data.length > 0 ? "failed" : "skipped",
    sent,
    failed
  });
}
