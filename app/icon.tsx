import { ImageResponse } from "next/og";
import { TenderTrackerIcon } from "@/lib/app-icon";

export const size = {
  width: 64,
  height: 64
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<TenderTrackerIcon size={64} />, size);
}

