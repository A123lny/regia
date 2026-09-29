// RS-3 RN-87 · getPartner / listPartners filtrano su organization_id.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getPartner, listPartners } from "@/modules/m07-partners/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("partners: tenant scoping IDOR (RS-3, RN-87)", () => {
  let partnerIdOrgA: string;
  let orgAId: string;
  let orgBId: string;
  let brandAId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — partners" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — partners" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-part-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand: ${brandA.error?.message}`);
    brandAId = (brandA.data as { id: string }).id;

    const p = await admin
      .from("partner_restaurants")
      .insert({
        organization_id: orgAId,
        brand_id: brandAId,
        name: "IDOR Restaurant",
        onboarding_status: "attivo",
      })
      .select("id")
      .single();
    if (p.error || !p.data) throw new Error(`Setup partner: ${p.error?.message}`);
    partnerIdOrgA = (p.data as { id: string }).id;
  });

  it("getPartner(id, orgB) → null (IDOR bloccato)", async () => {
    const result = await getPartner(partnerIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getPartner(id, orgA) → partner (legittimo)", async () => {
    const result = await getPartner(partnerIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(partnerIdOrgA);
  });

  it("listPartners(orgB) non vede partner di orgA", async () => {
    const items = await listPartners({ organizationId: orgBId, brandId: brandAId });
    const found = items.find((p) => p.id === partnerIdOrgA);
    expect(found).toBeUndefined();
  });
});
