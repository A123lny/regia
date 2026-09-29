// RS-3 RN-87 · getSegment/listSegments filtrano su organization_id (IDOR).

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getSegment, listSegments } from "@/modules/m07-outreach/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("segments: tenant scoping IDOR (RS-3, RN-87)", () => {
  let segmentIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — segments" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — segments" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-seg-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand: ${brandA.error?.message}`);

    const seg = await admin
      .from("contact_segments")
      .insert({
        organization_id: orgAId,
        brand_id: (brandA.data as { id: string }).id,
        name: "IDOR Segment",
        criteria: { minOrderCount: 1 },
      })
      .select("id")
      .single();
    if (seg.error || !seg.data) throw new Error(`Setup seg: ${seg.error?.message}`);
    segmentIdOrgA = (seg.data as { id: string }).id;
  });

  it("getSegment(id, orgB) → null (IDOR bloccato)", async () => {
    const result = await getSegment(segmentIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getSegment(id, orgA) → segmento (legittimo)", async () => {
    const result = await getSegment(segmentIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(segmentIdOrgA);
  });

  it("listSegments(orgB) non include segmenti di orgA", async () => {
    const items = await listSegments(orgBId, true);
    const found = items.find((s) => s.id === segmentIdOrgA);
    expect(found).toBeUndefined();
  });
});
