// RS-3 RN-87: listContentDraftsByBrand filtra su organization_id — IDOR cross-tenant impossibile.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { listContentDraftsByBrand } from "@/modules/m03-editorial/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("listContentDraftsByBrand: tenant scoping IDOR (RS-3, RN-87)", () => {
  let brandIdOrgA: string;
  let brandIdOrgB: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // Crea due org temporanee isolate per questo test.
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — list-tenant-scoping" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A fallito: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — list-tenant-scoping" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B fallito: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    // Crea un brand per org-A.
    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data)
      throw new Error(`Setup brand-A fallito: ${brandA.error?.message}`);
    brandIdOrgA = (brandA.data as { id: string }).id;

    // Crea un brand per org-B.
    const brandB = await admin
      .from("brands")
      .insert({
        organization_id: orgBId,
        slug: `brand-b-${orgBId.slice(0, 8)}`,
        display_name: "Brand B",
      })
      .select("id")
      .single();
    if (brandB.error || !brandB.data)
      throw new Error(`Setup brand-B fallito: ${brandB.error?.message}`);
    brandIdOrgB = (brandB.data as { id: string }).id;

    // Inserisci 2 draft per org-A.
    for (let i = 0; i < 2; i++) {
      const draft = await admin
        .from("content_drafts")
        .insert({
          organization_id: orgAId,
          brand_id: brandIdOrgA,
          channel: "social",
          theme_input: `test list org-a draft ${i}`,
          generated_text: `testo org-a ${i}`,
          prompt_version: "v1",
          model_used: "m",
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
          latency_ms: 0,
          created_by: null,
        })
        .select("id")
        .single();
      if (draft.error) throw new Error(`Setup draft org-A ${i} fallito: ${draft.error?.message}`);
    }

    // Inserisci 1 draft per org-B (con stesso brand slug per aumentare risk).
    const draftB = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgBId,
        brand_id: brandIdOrgB,
        channel: "social",
        theme_input: "test list org-b draft",
        generated_text: "testo org-b",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        created_by: null,
      })
      .select("id")
      .single();
    if (draftB.error) throw new Error(`Setup draft org-B fallito: ${draftB.error?.message}`);
  });

  it("listContentDraftsByBrand(brandIdOrgA, orgBId) → [] (IDOR bloccato)", async () => {
    // Un utente di Org-B NON deve vedere i draft di Org-A, anche se chiede un brand di Org-A.
    const result = await listContentDraftsByBrand(brandIdOrgA, orgBId);
    expect(result).toEqual([]);
  });

  it("listContentDraftsByBrand(brandIdOrgA, orgAId) → 2 draft (accesso legittimo)", async () => {
    // L'owner di Org-A deve poter leggere i propri draft di Brand A.
    const result = await listContentDraftsByBrand(brandIdOrgA, orgAId);
    expect(result).toHaveLength(2);
    if (result.length >= 2) {
      expect(result[0]?.organizationId).toBe(orgAId);
      expect(result[0]?.brandId).toBe(brandIdOrgA);
      expect(result[1]?.organizationId).toBe(orgAId);
      expect(result[1]?.brandId).toBe(brandIdOrgA);
    }
  });
});
