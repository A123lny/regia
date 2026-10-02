// M05 - endpoint chiamato da pg_cron ogni 1min per processare la coda invii.
// Protetto con secret in header authorization (env M05_CRON_SECRET).

import { NextResponse } from "next/server";
import { tickBatch } from "@/modules/m05-publishing/public"; // RS-1: via public.ts

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env["M05_CRON_SECRET"]}`;
  if (!process.env["M05_CRON_SECRET"] || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await tickBatch(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
