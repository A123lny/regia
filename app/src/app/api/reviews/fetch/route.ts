import { NextResponse } from "next/server";
import { fetchAllBrandsReviews, GooglePlacesAdapter } from "@/modules/m08-reviews/server";
import { getAdminClient } from "@/lib/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const expected = process.env["CRON_SECRET"];
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET non configurato" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env["GOOGLE_PLACES_API_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY non configurata" }, { status: 500 });
  }
  const adapter = new GooglePlacesAdapter(apiKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: orgs, error } = await admin.from("organizations").select("id");
  if (error) {
    return NextResponse.json({ error: `orgs: ${error.message}` }, { status: 500 });
  }

  const results: Record<string, unknown> = {};
  for (const org of (orgs ?? []) as { id: string }[]) {
    try {
      const summary = await fetchAllBrandsReviews(org.id, adapter);
      results[org.id] = summary;
    } catch (e) {
      results[org.id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, results });
}
