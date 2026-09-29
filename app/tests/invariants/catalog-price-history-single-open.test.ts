// RF-1.5 · UNIQUE parziale su brand_product_prices dove valid_to IS NULL.
// Un solo record "aperto" per prodotto — il prezzo corrente è univoco.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.5 · price history single-open constraint", () => {
  let orgId: string;
  let productId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — price-history" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-ph-${orgId.slice(0, 8)}`,
        display_name: "Brand PH",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);

    const product = await admin
      .from("brand_products")
      .insert({
        organization_id: orgId,
        brand_id: (brand.data as { id: string }).id,
        sku: "PH-01",
        name: "Prodotto storia",
        category: "Test",
        unit: "pezzo",
        source: "manuale",
      })
      .select("id")
      .single();
    if (product.error || !product.data) throw new Error(`Setup product: ${product.error?.message}`);
    productId = (product.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("primo insert prezzo aperto → OK", async () => {
    const r = await admin
      .from("brand_product_prices")
      .insert({
        organization_id: orgId,
        product_id: productId,
        price_cents: 1000,
        valid_from: new Date("2026-01-01T00:00:00Z").toISOString(),
        valid_to: null,
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("secondo insert aperto (senza chiudere il primo) → violazione UNIQUE parziale", async () => {
    const r = await admin.from("brand_product_prices").insert({
      organization_id: orgId,
      product_id: productId,
      price_cents: 1200,
      valid_from: new Date("2026-02-01T00:00:00Z").toISOString(),
      valid_to: null,
    });
    expect(r.error).not.toBeNull();
    expect(r.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
  });

  it("chiudo il primo e reinserisco un nuovo aperto → OK", async () => {
    // chiudo
    const closeR = await admin
      .from("brand_product_prices")
      .update({ valid_to: new Date("2026-02-01T00:00:00Z").toISOString() })
      .eq("product_id", productId)
      .is("valid_to", null);
    expect(closeR.error).toBeNull();

    // reinserisco
    const insR = await admin
      .from("brand_product_prices")
      .insert({
        organization_id: orgId,
        product_id: productId,
        price_cents: 1200,
        valid_from: new Date("2026-02-01T00:00:00Z").toISOString(),
        valid_to: null,
      })
      .select("id");
    expect(insR.error).toBeNull();
  });

  it("valid_to <= valid_from → violazione check", async () => {
    const r = await admin.from("brand_product_prices").insert({
      organization_id: orgId,
      product_id: productId,
      price_cents: 999,
      valid_from: new Date("2026-03-01T00:00:00Z").toISOString(),
      valid_to: new Date("2026-02-15T00:00:00Z").toISOString(),
    });
    expect(r.error).not.toBeNull();
  });
});
