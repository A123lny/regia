// M7 · segment evaluator: verifica dei criteri di segmentazione RF-1.8.
// Setup: crea 3 contatti (A abituale con consenso email, B dormiente, C senza consenso),
// alcuni ordini, e testa varie combinazioni di criteri.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { countMatchingContacts } from "@/modules/m07-outreach/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.8 · segment evaluator", () => {
  let orgId: string;
  let brandId: string;
  let contactAId: string;
  let contactCId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — segment-eval" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-eval-${orgId.slice(0, 8)}`,
        display_name: "Brand eval",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    // Contact A: abituale, 5 ordini recenti, consenso email, tag residente
    const cA = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "A",
        email: "a@example.it",
        source: "manuale",
        tags: ["residente"],
      })
      .select("id")
      .single();
    if (cA.error || !cA.data) throw new Error(`Setup A: ${cA.error?.message}`);
    contactAId = (cA.data as { id: string }).id;

    await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactAId,
      channel: "email",
      status: "granted",
      granted_at: new Date().toISOString(),
      source: "manuale",
    });

    for (let i = 0; i < 5; i++) {
      await admin.from("brand_orders").insert({
        organization_id: orgId,
        brand_id: brandId,
        contact_id: contactAId,
        channel: "store",
        status: "completed",
        total_cents: 1500,
        placed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(
          Date.now() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    // Contact B: dormiente (nessun ordine recente), tag residente
    const cB = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "B",
        email: "b@example.it",
        source: "manuale",
        tags: ["residente"],
      })
      .select("id")
      .single();
    if (cB.error || !cB.data) throw new Error(`Setup B: ${cB.error?.message}`);
    // contactBId non usato negli asserts — B è il "dormiente" implicito (no ordini)
    void (cB.data as { id: string }).id;

    // Contact C: attivo ma senza consenso email
    const cC = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "C",
        email: "c@example.it",
        source: "manuale",
        tags: ["turista"],
      })
      .select("id")
      .single();
    if (cC.error || !cC.data) throw new Error(`Setup C: ${cC.error?.message}`);
    contactCId = (cC.data as { id: string }).id;

    for (let i = 0; i < 3; i++) {
      await admin.from("brand_orders").insert({
        organization_id: orgId,
        brand_id: brandId,
        contact_id: contactCId,
        channel: "store",
        status: "completed",
        total_cents: 500,
        placed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(
          Date.now() - 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
        ).toISOString(),
      });
    }
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("nessun criterio → tutti e 3 i contatti", async () => {
    const n = await countMatchingContacts(orgId, brandId, {});
    expect(n).toBe(3);
  });

  it("minOrderCount=3 → A e C (2)", async () => {
    const n = await countMatchingContacts(orgId, brandId, { minOrderCount: 3 });
    expect(n).toBe(2);
  });

  it("minOrderCount=5 → solo A (1)", async () => {
    const n = await countMatchingContacts(orgId, brandId, { minOrderCount: 5 });
    expect(n).toBe(1);
  });

  it("requiredConsentChannel=email → solo A (unico con consenso)", async () => {
    const n = await countMatchingContacts(orgId, brandId, {
      requiredConsentChannel: "email",
    });
    expect(n).toBe(1);
  });

  it("lastOrderMinDays=90 → solo B (dormiente da sempre)", async () => {
    const n = await countMatchingContacts(orgId, brandId, { lastOrderMinDays: 90 });
    expect(n).toBe(1);
  });

  it("requiredTags=['residente'] → A e B (entrambi residenti)", async () => {
    const n = await countMatchingContacts(orgId, brandId, { requiredTags: ["residente"] });
    expect(n).toBe(2);
  });

  it("excludeTags=['turista'] → A e B (esclude C)", async () => {
    const n = await countMatchingContacts(orgId, brandId, { excludeTags: ["turista"] });
    expect(n).toBe(2);
  });

  it("combinazione: consenso email + minOrderCount=3 → solo A", async () => {
    const n = await countMatchingContacts(orgId, brandId, {
      requiredConsentChannel: "email",
      minOrderCount: 3,
    });
    expect(n).toBe(1);
  });
});
