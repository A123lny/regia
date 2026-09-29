// M10 · UNIQUE (organization_id, slug) su signup_landings + validazione formato slug.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-10.1 · signup landing UNIQUE + slug format", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — landing" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-land-${orgId.slice(0, 8)}`,
        display_name: "Brand landing",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("primo insert slug valido → OK", async () => {
    const r = await admin
      .from("signup_landings")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        slug: "test-landing-1",
        headline: "Test",
        benefit_headline: "Benefit",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("stesso slug stessa org → violazione UNIQUE", async () => {
    const r = await admin.from("signup_landings").insert({
      organization_id: orgId,
      brand_id: brandId,
      slug: "test-landing-1",
      headline: "Duplicato",
      benefit_headline: "Benefit",
    });
    expect(r.error).not.toBeNull();
    expect(r.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
  });

  it("slug con maiuscole → violazione check format", async () => {
    const r = await admin.from("signup_landings").insert({
      organization_id: orgId,
      brand_id: brandId,
      slug: "Test-Landing-Uppercase",
      headline: "Test",
      benefit_headline: "Benefit",
    });
    expect(r.error).not.toBeNull();
  });

  it("slug troppo corto (1 char) → violazione check format", async () => {
    const r = await admin.from("signup_landings").insert({
      organization_id: orgId,
      brand_id: brandId,
      slug: "a",
      headline: "Test",
      benefit_headline: "Benefit",
    });
    expect(r.error).not.toBeNull();
  });

  it("slug con underscore → violazione check format", async () => {
    const r = await admin.from("signup_landings").insert({
      organization_id: orgId,
      brand_id: brandId,
      slug: "test_landing_underscore",
      headline: "Test",
      benefit_headline: "Benefit",
    });
    expect(r.error).not.toBeNull();
  });

  it("headline vuota → violazione check", async () => {
    const r = await admin.from("signup_landings").insert({
      organization_id: orgId,
      brand_id: brandId,
      slug: "empty-headline",
      headline: "   ",
      benefit_headline: "Benefit",
    });
    expect(r.error).not.toBeNull();
  });
});
