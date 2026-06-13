import { NextResponse } from "next/server";

export function noStoreJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {})
    }
  });
}
