// M13 · commercial guard: findForbiddenProductsInBrand + validateOfferAgainstCommercialRules
// RF-6.15..6.17: offerta a valore/percentuale su brand con prodotti forbidden → throw.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  findForbiddenProductsInBrand,
  validateOfferAgainstCommercialRules,
  CommercialGuardError,
} from "@/modules/m13-governance/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("M13 · commercial guard RF-6.15..6.17", () => {
  let orgId: string;
  let brandWithForbiddenId: string;
  let brandWithoutForbiddenId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — guard" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-a-grd-${orgId.slice(0, 8)}`,
        display_name: "Brand con forbidden",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup A: ${brandA.error?.message}`);
    brandWithForbiddenId = (brandA.data as { id: string }).id;

    const brandB = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-b-grd-${orgId.slice(0, 8)}`,
        display_name: "Brand pulito",
      })
      .select("id")
      .single();
    if (brandB.error || !brandB.data) throw new Error(`Setup B: ${brandB.error?.message}`);
    brandWithoutForbiddenId = (brandB.data as { id: string }).id;

    // Prodotto forbidden in brand A
    await admin.from("brand_products").insert({
      organization_id: orgId,
      brand_id: brandWithForbiddenId,
      sku: "FORBIDDEN-1",
      name: "Carburante test",
      category: "Carburante",
      unit: "litro",
      source: "manuale",
      discount_forbidden: true,
      discount_forbidden_reason: "test guard",
    });
    // Prodotto libero in brand A
    await admin.from("brand_products").insert({
      organization_id: orgId,
      brand_id: brandWithForbiddenId,
      sku: "FREE-A",
      name: "Servizio libero A",
      category: "Servizio",
      unit: "servizio",
      source: "manuale",
      discount_forbidden: false,
    });
    // Prodotto libero in brand B
    await admin.from("brand_products").insert({
      organization_id: orgId,
      brand_id: brandWithoutForbiddenId,
      sku: "FREE-B",
      name: "Pasta pomodoro",
      category: "Pasta",
      unit: "pezzo",
      source: "manuale",
      discount_forbidden: false,
    });
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("findForbiddenProductsInBrand brand con forbidden → 1 risultato", async () => {
    const list = await findForbiddenProductsInBrand(orgId, brandWithForbiddenId);
    expect(list.length).toBe(1);
    expect(list[0]?.sku).toBe("FORBIDDEN-1");
    expect(list[0]?.reason).toBe("test guard");
  });

  it("findForbiddenProductsInBrand brand pulito → 0 risultati", async () => {
    const list = await findForbiddenProductsInBrand(orgId, brandWithoutForbiddenId);
    expect(list.length).toBe(0);
  });

  it("validateOfferAgainstCommercialRules su brand con forbidden + reward valore_fisso → THROW", async () => {
    await expect(
      validateOfferAgainstCommercialRules({
        organizationId: orgId,
        spendableBrandId: brandWithForbiddenId,
        rewardKind: "valore_fisso",
      }),
    ).rejects.toThrow(CommercialGuardError);
  });

  it("validate su brand con forbidden + reward percentuale → THROW", async () => {
    await expect(
      validateOfferAgainstCommercialRules({
        organizationId: orgId,
        spendableBrandId: brandWithForbiddenId,
        rewardKind: "percentuale",
      }),
    ).rejects.toThrow(CommercialGuardError);
  });

  it("validate su brand con forbidden + reward servizio_gratis → NO throw (sconti monetari non applicabili)", async () => {
    await expect(
      validateOfferAgainstCommercialRules({
        organizationId: orgId,
        spendableBrandId: brandWithForbiddenId,
        rewardKind: "servizio_gratis",
      }),
    ).resolves.toBeUndefined();
  });

  it("validate su brand pulito → NO throw", async () => {
    await expect(
      validateOfferAgainstCommercialRules({
        organizationId: orgId,
        spendableBrandId: brandWithoutForbiddenId,
        rewardKind: "valore_fisso",
      }),
    ).resolves.toBeUndefined();
  });

  it("validate con confirmOverride=true su brand con forbidden → NO throw (bypass consentito)", async () => {
    await expect(
      validateOfferAgainstCommercialRules({
        organizationId: orgId,
        spendableBrandId: brandWithForbiddenId,
        rewardKind: "valore_fisso",
        confirmOverride: true,
      }),
    ).resolves.toBeUndefined();
  });
});
