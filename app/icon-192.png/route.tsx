import { ImageResponse } from "next/og";
import { TenderTrackerIcon } from "@/lib/app-icon";

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(<TenderTrackerIcon size={192} />, {
    width: 192,
    height: 192
  });
}

