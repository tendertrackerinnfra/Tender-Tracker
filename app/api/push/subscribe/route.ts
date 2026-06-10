import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";
import { getSupabaseAdmin } from "@/lib/supabase";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const subscription = subscriptionSchema.parse(body);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return noStoreJson({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      subscription,
      updated_at: new Date().toISOString()
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    await captureError(error, { route: "/api/push/subscribe" });
    return noStoreJson({ error: error.message }, { status: 500 });
  }

  return noStoreJson({ ok: true });
}
