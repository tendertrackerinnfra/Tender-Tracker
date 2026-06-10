import { NextResponse } from "next/server";

export function cachedJson<T>(data: T, maxAgeSeconds = 30, staleWhileRevalidateSeconds = 120) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
    }
  });
}

export function noStoreJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {})
    }
  });
}
