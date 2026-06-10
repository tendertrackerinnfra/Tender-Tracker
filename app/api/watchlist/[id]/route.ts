import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { noStoreJson } from "@/lib/http";
import { captureError } from "@/lib/monitoring";
import { removeWatchlistStock, trackWatchlistStock } from "@/lib/watchlist";

const trackSchema = z.object({
  isTracked: z.boolean()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = trackSchema.parse(await request.json());
    const stock = await trackWatchlistStock(id, input.isTracked);
    return noStoreJson({ stock });
  } catch (error) {
    await captureError(error, { route: "/api/watchlist/[id]", method: "PATCH" });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to update stock tracking." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await removeWatchlistStock(id);
    return noStoreJson({ ok: true });
  } catch (error) {
    await captureError(error, { route: "/api/watchlist/[id]", method: "DELETE" });
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to remove stock." },
      { status: 400 }
    );
  }
}
