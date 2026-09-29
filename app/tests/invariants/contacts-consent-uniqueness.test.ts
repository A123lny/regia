// RF-1.4 · UNIQUE (contact_id, channel) su contact_consents.
// Un solo record vivo per (contatto, canale) — le revoche NON creano nuovo record,
// aggiornano lo status del record esistente. Vincolo DB (RS-3).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.4 · consensi UNIQUE per (contact, canale)", () => {
  let orgId: string;
  let brandId: string;
  let contactId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — consent-unique" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-consent-${orgId.slice(0, 8)}`,
        display_name: "Brand consent",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "Test",
        email: "consent@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data)
      throw new Error(`Setup contact fallito: ${contact.error?.message}`);
    contactId = (contact.data as { id: string }).id;
  });

  afterAll(async () => {
    // Cascade cancella consent + contact + brand quando cancelli org
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("primo insert di consenso email → OK", async () => {
    const r = await admin
      .from("contact_consents")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        channel: "email",
        status: "granted",
        granted_at: new Date().toISOString(),
        source: "manuale",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("secondo insert stesso canale → violazione UNIQUE", async () => {
    const r = await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactId,
      channel: "email",
      status: "granted",
      granted_at: new Date().toISOString(),
      source: "manuale",
    });
    expect(r.error).not.toBeNull();
    expect(r.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
  });

  it("insert stesso contact su altro canale → OK (canali indipendenti)", async () => {
    const r = await admin
      .from("contact_consents")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        channel: "sms",
        status: "never",
        source: "manuale",
      })
      .select("id");
    expect(r.error).toBeNull();
  });
});
