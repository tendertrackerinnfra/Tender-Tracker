import { noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const checks = {
    app: true,
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.TENDER_TRACKER_SUPABASE_SERVICE_ROLE_KEY),
    vapidPublicKey: Boolean(process.env.NEXT_PUBLIC_TENDER_TRACKER_VAPID_PUBLIC_KEY),
    vapidPrivateKey: Boolean(process.env.TENDER_TRACKER_VAPID_PRIVATE_KEY),
    tenderTrackerApiKey: Boolean(process.env.TENDER_TRACKER_API_KEY),
    database: false
  };

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("tenders").select("id").limit(1);
      checks.database = !error;
      if (error) {
        await captureError(error, { route: "/api/health", phase: "database_check" });
      }
    }
  } catch (error) {
    await captureError(error, { route: "/api/health" });
  }

  const healthy = checks.app && checks.supabaseUrl && checks.supabaseServiceRole && checks.database;

  return noStoreJson(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString()
    },
    { status: healthy ? 200 : 503 }
  );
}
