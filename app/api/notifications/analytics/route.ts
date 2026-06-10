import { cachedJson, noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";
import { getNotificationAnalytics } from "@/lib/notifications";

export async function GET() {
  try {
    const data = await getNotificationAnalytics();
    return cachedJson(data, 30, 120);
  } catch (error) {
    await captureError(error, { route: "/api/notifications/analytics" });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load notification analytics." },
      { status: 500 }
    );
  }
}
