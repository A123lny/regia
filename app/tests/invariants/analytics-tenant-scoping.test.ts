// M08 · analytics tenant scoping: le aggregazioni non sommano dati cross-org.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  getContactsAnalytics,
  getOrdersAnalytics,
  getPartnersAnalytics,
} from "@/modules/m08-analytics/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("M08 · analytics tenant scoping (RS-3, RN-87)", () => {
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — analytics" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — analytics" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    // Setup: 1 brand, 3 contatti, 2 ordini, 1 partner in orgA
    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-anly-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand: ${brandA.error?.message}`);
    const brandAId = (brandA.data as { id: string }).id;

    for (let i = 0; i < 3; i++) {
      await admin.from("contacts").insert({
        organization_id: orgAId,
        brand_id: brandAId,
        first_name: `A${i}`,
        email: `a${i}@example.it`,
        source: "manuale",
      });
    }
    for (let i = 0; i < 2; i++) {
      await admin.from("brand_orders").insert({
        organization_id: orgAId,
        brand_id: brandAId,
        channel: "store",
        status: "completed",
        placed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }
    await admin.from("partner_restaurants").insert({
      organization_id: orgAId,
      brand_id: brandAId,
      name: "Test Partner A",
      onboarding_status: "attivo",
    });
  });

  it("orgB analytics contatti: totale 0 (nessun leak da orgA)", async () => {
    const a = await getContactsAnalytics(orgBId, "30d");
    expect(a.totalActive).toBe(0);
    expect(a.newInPeriod).toBe(0);
    expect(a.bySource.length).toBe(0);
  });

  it("orgA analytics contatti: totale 3 (dati corretti)", async () => {
    const a = await getContactsAnalytics(orgAId, "30d");
    expect(a.totalActive).toBe(3);
  });

  it("orgB analytics ordini: countInPeriod 0", async () => {
    const o = await getOrdersAnalytics(orgBId, "30d");
    expect(o.countInPeriod).toBe(0);
    expect(o.totalCentsInPeriod).toBe(0);
  });

  it("orgA analytics ordini: countInPeriod 2", async () => {
    const o = await getOrdersAnalytics(orgAId, "30d");
    expect(o.countInPeriod).toBe(2);
  });

  it("orgB partners analytics: byStatus vuoto", async () => {
    const p = await getPartnersAnalytics(orgBId);
    expect(p.totalActive).toBe(0);
    expect(p.byStatus.length).toBe(0);
  });

  it("orgA partners analytics: 1 attivo", async () => {
    const p = await getPartnersAnalytics(orgAId);
    expect(p.totalActive).toBe(1);
  });
});
