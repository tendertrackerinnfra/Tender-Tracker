import { cachedJson } from "@/lib/http";
import { getLatestReport } from "@/lib/reports";

export async function GET() {
  const report = await getLatestReport();
  return cachedJson({ report }, 30, 120);
}
