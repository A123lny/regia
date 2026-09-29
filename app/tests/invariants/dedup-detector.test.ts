// RF-1.7 · dedup detector: match case-insensitive email + normalizza telefono.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { findDuplicateGroups } from "@/modules/m01-data-hub/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.7 · dedup detector", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — dedup" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-dup-${orgId.slice(0, 8)}`,
        display_name: "Brand dup",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("nessun contatto → nessun gruppo", async () => {
    const groups = await findDuplicateGroups(orgId);
    expect(groups.length).toBe(0);
  });

  it("email uguale case diverso → gruppo email", async () => {
    await admin.from("contacts").insert([
      {
        organization_id: orgId,
        brand_id: brandId,
        first_name: "A",
        email: "test@Example.com",
        source: "manuale",
      },
      {
        organization_id: orgId,
        brand_id: brandId,
        first_name: "B",
        email: "TEST@example.com",
        source: "manuale",
      },
    ]);
    const groups = await findDuplicateGroups(orgId);
    const emailGroups = groups.filter((g) => g.matchKind === "email");
    expect(emailGroups.length).toBe(1);
    expect(emailGroups[0]?.contacts.length).toBe(2);
    expect(emailGroups[0]?.matchValue).toBe("test@example.com");
  });

  it("telefono uguale con spazi diversi → gruppo phone", async () => {
    await admin.from("contacts").insert([
      {
        organization_id: orgId,
        brand_id: brandId,
        first_name: "C",
        phone: "+39 333 1234567",
        source: "manuale",
      },
      {
        organization_id: orgId,
        brand_id: brandId,
        first_name: "D",
        phone: "+393331234567",
        source: "manuale",
      },
      {
        organization_id: orgId,
        brand_id: brandId,
        first_name: "E",
        phone: "+39-333-1234-567",
        source: "manuale",
      },
    ]);
    const groups = await findDuplicateGroups(orgId);
    const phoneGroups = groups.filter((g) => g.matchKind === "phone");
    expect(phoneGroups.length).toBe(1);
    expect(phoneGroups[0]?.contacts.length).toBe(3);
    expect(phoneGroups[0]?.matchValue).toBe("393331234567");
  });

  it("contatti già archiviati NON contano come duplicati", async () => {
    const a = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "Arch",
        email: "arch@test.com",
        source: "manuale",
        archived_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(a.error).toBeNull();
    await admin.from("contacts").insert({
      organization_id: orgId,
      brand_id: brandId,
      first_name: "Arch2",
      email: "arch@test.com",
      source: "manuale",
    });
    const groups = await findDuplicateGroups(orgId);
    // Solo 1 record attivo con quella email → nessun gruppo
    const archGroup = groups.find((g) => g.matchValue === "arch@test.com");
    expect(archGroup).toBeUndefined();
  });
});
