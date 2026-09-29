// RS-3 RN-87 · getLandingById filtra su organization_id (IDOR).

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getLandingById, listLandings } from "@/modules/m10-signup/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("signup landings: tenant scoping IDOR", () => {
  let landingIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — signup" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — signup" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-sig-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand: ${brandA.error?.message}`);

    const l = await admin
      .from("signup_landings")
      .insert({
        organization_id: orgAId,
        brand_id: (brandA.data as { id: string }).id,
        slug: `test-idor-${orgAId.slice(0, 8)}`,
        headline: "Test",
        benefit_headline: "Benefit",
      })
      .select("id")
      .single();
    if (l.error || !l.data) throw new Error(`Setup landing: ${l.error?.message}`);
    landingIdOrgA = (l.data as { id: string }).id;
  });

  it("getLandingById(id, orgB) → null (IDOR bloccato)", async () => {
    const result = await getLandingById(landingIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getLandingById(id, orgA) → landing (legittimo)", async () => {
    const result = await getLandingById(landingIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(landingIdOrgA);
  });

  it("listLandings(orgB) non include landing di orgA", async () => {
    const items = await listLandings(orgBId, true);
    const found = items.find((l) => l.id === landingIdOrgA);
    expect(found).toBeUndefined();
  });
});
