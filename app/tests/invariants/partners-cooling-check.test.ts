// RF-7.4 · Check constraint partners_cooling_needs_reason:
//   cooling_flag=true → cooling_reason NOT NULL e non vuoto
//   cooling_flag=false → cooling_reason può essere NULL

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-7.4 · partner cooling reason required check", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — cooling" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-cool-${orgId.slice(0, 8)}`,
        display_name: "Brand cool",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("cooling=false senza reason → OK", async () => {
    const r = await admin
      .from("partner_restaurants")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "Cool-A",
        onboarding_status: "attivo",
        cooling_flag: false,
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("cooling=true con reason → OK", async () => {
    const r = await admin
      .from("partner_restaurants")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "Cool-B",
        onboarding_status: "attivo",
        cooling_flag: true,
        cooling_reason: "Ordini in calo",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("cooling=true SENZA reason → violazione check", async () => {
    const r = await admin.from("partner_restaurants").insert({
      organization_id: orgId,
      brand_id: brandId,
      name: "Cool-C",
      onboarding_status: "attivo",
      cooling_flag: true,
      cooling_reason: null,
    });
    expect(r.error).not.toBeNull();
  });

  it("cooling=true con reason vuota → violazione check", async () => {
    const r = await admin.from("partner_restaurants").insert({
      organization_id: orgId,
      brand_id: brandId,
      name: "Cool-D",
      onboarding_status: "attivo",
      cooling_flag: true,
      cooling_reason: "   ",
    });
    expect(r.error).not.toBeNull();
  });
});
