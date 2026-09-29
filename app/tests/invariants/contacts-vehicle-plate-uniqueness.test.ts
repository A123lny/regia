// RF-1.3 · UNIQUE (organization_id, plate) su contact_vehicles.
// Mai due veicoli con stessa targa nella stessa organization, anche se agganciati
// a contatti diversi. Vincolo DB (RS-3).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.3 · veicoli plate UNIQUE per organization", () => {
  let orgId: string;
  let contactAId: string;
  let contactBId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — plate-unique" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-plate-${orgId.slice(0, 8)}`,
        display_name: "Brand plate",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    const brandId = (brand.data as { id: string }).id;

    for (const [alias, idHolder] of [
      ["A", (v: string) => (contactAId = v)],
      ["B", (v: string) => (contactBId = v)],
    ] as const) {
      const c = await admin
        .from("contacts")
        .insert({
          organization_id: orgId,
          brand_id: brandId,
          first_name: `Contact ${alias}`,
          email: `${alias.toLowerCase()}@example.it`,
          source: "manuale",
        })
        .select("id")
        .single();
      if (c.error || !c.data) throw new Error(`Setup contact ${alias}: ${c.error?.message}`);
      idHolder((c.data as { id: string }).id);
    }
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("insert veicolo su contact A → OK", async () => {
    const r = await admin
      .from("contact_vehicles")
      .insert({
        organization_id: orgId,
        contact_id: contactAId,
        plate: "AB123XY",
        model: "VW Golf",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("insert stessa targa su contact B (stessa org) → violazione UNIQUE", async () => {
    const r = await admin.from("contact_vehicles").insert({
      organization_id: orgId,
      contact_id: contactBId,
      plate: "AB123XY",
      model: "Fiat Panda",
    });
    expect(r.error).not.toBeNull();
    expect(r.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
  });

  it("plate troppo corta (<5) → violazione check", async () => {
    const r = await admin.from("contact_vehicles").insert({
      organization_id: orgId,
      contact_id: contactAId,
      plate: "AB1",
    });
    expect(r.error).not.toBeNull();
  });
});
