// RF-1.4 · Check constraint consent_status_timestamps_coherent.
// granted → granted_at not null, revoked_at null
// revoked → granted_at not null, revoked_at not null
// never   → granted_at null, revoked_at null

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-1.4 · consent status/timestamp coerenti", () => {
  let orgId: string;
  let contactId: string;
  const usedChannels: string[] = [];

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — consent-timestamps" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-ts-${orgId.slice(0, 8)}`,
        display_name: "Brand ts",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    const brandId = (brand.data as { id: string }).id;

    const c = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "TS",
        email: "ts@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (c.error || !c.data) throw new Error(`Setup contact: ${c.error?.message}`);
    contactId = (c.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  // Ogni test usa un canale diverso per non collidere con UNIQUE (contact, channel)
  it("granted + granted_at + revoked_at=null → OK", async () => {
    const channel = "email";
    usedChannels.push(channel);
    const r = await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactId,
      channel,
      status: "granted",
      granted_at: new Date().toISOString(),
      revoked_at: null,
      source: "manuale",
    });
    expect(r.error).toBeNull();
  });

  it("granted senza granted_at → violazione check", async () => {
    const r = await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactId,
      channel: "sms",
      status: "granted",
      granted_at: null,
      source: "manuale",
    });
    expect(r.error).not.toBeNull();
  });

  it("revoked senza revoked_at → violazione check", async () => {
    const r = await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactId,
      channel: "sms",
      status: "revoked",
      granted_at: new Date().toISOString(),
      revoked_at: null,
      source: "manuale",
    });
    expect(r.error).not.toBeNull();
  });

  it("never con granted_at valorizzato → violazione check", async () => {
    const r = await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactId,
      channel: "whatsapp",
      status: "never",
      granted_at: new Date().toISOString(),
      source: "manuale",
    });
    expect(r.error).not.toBeNull();
  });
});
