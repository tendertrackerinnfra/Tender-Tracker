import { ImageResponse } from "next/og";
import { TenderTrackerIcon } from "@/lib/app-icon";

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(<TenderTrackerIcon size={512} />, {
    width: 512,
    height: 512
  });
}

