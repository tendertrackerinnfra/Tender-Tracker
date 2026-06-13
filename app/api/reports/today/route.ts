import { noStoreJson } from "@/lib/http";
import { getLatestReport } from "@/lib/reports";

export async function GET() {
  const report = await getLatestReport();
  return noStoreJson({ report });
}
