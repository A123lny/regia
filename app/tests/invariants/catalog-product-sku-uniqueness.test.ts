// RF-1.2 · UNIQUE (organization_id, brand_id, sku) su brand_products.
// Impedisce SKU duplicati per lo stesso brand.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.2 · product SKU UNIQUE per (org, brand)", () => {
  let orgId: string;
  let brandAId: string;
  let brandBId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — sku-unique" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    for (const [alias, holder] of [
      ["A", (v: string) => (brandAId = v)],
      ["B", (v: string) => (brandBId = v)],
    ] as const) {
      const b = await admin
        .from("brands")
        .insert({
          organization_id: orgId,
          slug: `brand-${alias.toLowerCase()}-sku-${orgId.slice(0, 8)}`,
          display_name: `Brand ${alias}`,
        })
        .select("id")
        .single();
      if (b.error || !b.data) throw new Error(`Setup brand ${alias}: ${b.error?.message}`);
      holder((b.data as { id: string }).id);
    }
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("primo insert SKU su brand A → OK", async () => {
    const r = await admin
      .from("brand_products")
      .insert({
        organization_id: orgId,
        brand_id: brandAId,
        sku: "TEST-SKU-1",
        name: "Prodotto test",
        category: "Test",
        unit: "pezzo",
        source: "manuale",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("stesso SKU sullo stesso brand A → violazione UNIQUE", async () => {
    const r = await admin.from("brand_products").insert({
      organization_id: orgId,
      brand_id: brandAId,
      sku: "TEST-SKU-1",
      name: "Duplicato",
      category: "Test",
      unit: "pezzo",
      source: "manuale",
    });
    expect(r.error).not.toBeNull();
    expect(r.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
  });

  it("stesso SKU su brand B (stessa org) → OK (SKU indipendenti per brand)", async () => {
    const r = await admin
      .from("brand_products")
      .insert({
        organization_id: orgId,
        brand_id: brandBId,
        sku: "TEST-SKU-1",
        name: "Prodotto brand B",
        category: "Test",
        unit: "pezzo",
        source: "manuale",
      })
      .select("id");
    expect(r.error).toBeNull();
  });
});
