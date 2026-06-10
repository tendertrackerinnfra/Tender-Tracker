import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";
import { addWatchlistStock, getWatchlistDashboard } from "@/lib/watchlist";

const addStockSchema = z.object({
  symbol: z.string().min(1).max(24),
  name: z.string().max(120).optional()
});

export async function GET() {
  try {
    const data = await getWatchlistDashboard();
    return noStoreJson(data);
  } catch (error) {
    await captureError(error, { route: "/api/watchlist", method: "GET" });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load watchlist." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = addStockSchema.parse(await request.json());
    const stock = await addWatchlistStock(input);
    return noStoreJson({ stock });
  } catch (error) {
    await captureError(error, { route: "/api/watchlist", method: "POST" });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to add stock." },
      { status: 400 }
    );
  }
}
