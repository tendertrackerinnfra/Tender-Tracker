import { cachedJson, noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";
import { getDashboardData } from "@/lib/reports";

export async function GET() {
  try {
    const data = await getDashboardData();
    return cachedJson(data, 30, 120);
  } catch (error) {
    await captureError(error, { route: "/api/dashboard" });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load dashboard data." },
      { status: 500 }
    );
  }
}
