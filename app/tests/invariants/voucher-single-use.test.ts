// RF-6.26 · voucher a uso singolo — redeemVoucherAtomic è atomico via .eq('status','issued').
// Testa: doppio riscatto rifiutato + status coerente + UNIQUE code.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-6.26 · voucher uso singolo + UNIQUE code", () => {
  let orgId: string;
  let brandId: string;
  let contactId: string;
  let offerId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — voucher-single-use" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-vsu-${orgId.slice(0, 8)}`,
        display_name: "Brand VSU",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "VSU",
        email: "vsu@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`Setup contact: ${contact.error?.message}`);
    contactId = (contact.data as { id: string }).id;

    const offer = await admin
      .from("voucher_offers")
      .insert({
        organization_id: orgId,
        issuer_brand_id: brandId,
        spendable_brand_id: brandId,
        name: "Offer VSU",
        reward_kind: "valore_fisso",
        reward_value_cents: 500,
        default_expires_days: 60,
      })
      .select("id")
      .single();
    if (offer.error || !offer.data) throw new Error(`Setup offer: ${offer.error?.message}`);
    offerId = (offer.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("emissione voucher → status='issued'", async () => {
    const r = await admin
      .from("vouchers")
      .insert({
        organization_id: orgId,
        offer_id: offerId,
        contact_id: contactId,
        code: "TESTVSU1",
        reward_kind: "valore_fisso",
        reward_value_cents: 500,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, status");
    expect(r.error).toBeNull();
    expect((r.data as Array<{ status: string }>)[0]?.status).toBe("issued");
  });

  it("stesso codice → violazione UNIQUE", async () => {
    const r = await admin.from("vouchers").insert({
      organization_id: orgId,
      offer_id: offerId,
      contact_id: contactId,
      code: "TESTVSU1",
      reward_kind: "valore_fisso",
      reward_value_cents: 500,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(r.error).not.toBeNull();
  });

  it("riscatto atomico: primo update .eq('status','issued') passa, secondo fallisce", async () => {
    // Primo riscatto: guardia matches → OK
    const first = await admin
      .from("vouchers")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
      .eq("code", "TESTVSU1")
      .eq("organization_id", orgId)
      .eq("status", "issued")
      .select("id");
    expect(first.error).toBeNull();
    expect((first.data as Array<{ id: string }>).length).toBe(1);

    // Secondo tentativo: status ora è 'redeemed', guard non matcha → 0 righe
    const second = await admin
      .from("vouchers")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
      .eq("code", "TESTVSU1")
      .eq("organization_id", orgId)
      .eq("status", "issued")
      .select("id");
    expect(second.error).toBeNull();
    expect((second.data as Array<{ id: string }>).length).toBe(0);
  });

  it("status='redeemed' senza redeemed_at → violazione check", async () => {
    const r = await admin.from("vouchers").insert({
      organization_id: orgId,
      offer_id: offerId,
      contact_id: contactId,
      code: "TESTVSU2",
      reward_kind: "valore_fisso",
      reward_value_cents: 500,
      status: "redeemed",
      redeemed_at: null,
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(r.error).not.toBeNull();
  });

  it("expires_at <= issued_at → violazione check", async () => {
    const iso = new Date().toISOString();
    const r = await admin.from("vouchers").insert({
      organization_id: orgId,
      offer_id: offerId,
      contact_id: contactId,
      code: "TESTVSU3",
      reward_kind: "valore_fisso",
      reward_value_cents: 500,
      issued_at: iso,
      expires_at: iso, // uguale → violazione
    });
    expect(r.error).not.toBeNull();
  });
});
