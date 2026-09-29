// M08 · empty state: nessuna eccezione con org senza dati.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  getContactsAnalytics,
  getOrdersAnalytics,
  getLoyaltyAnalytics,
  getOutreachAnalytics,
  getPartnersAnalytics,
  getSignupAnalytics,
} from "@/modules/m08-analytics/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("M08 · empty state (nessun dato → no throw, valori zero)", () => {
  let emptyOrgId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — empty analytics" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup: ${org.error?.message}`);
    emptyOrgId = (org.data as { id: string }).id;
  });

  it("getContactsAnalytics org vuota → totali zero, no throw", async () => {
    const a = await getContactsAnalytics(emptyOrgId, "30d");
    expect(a.totalActive).toBe(0);
    expect(a.totalArchived).toBe(0);
    expect(a.newInPeriod).toBe(0);
    expect(a.newPreviousPeriod).toBe(0);
    expect(a.bySource).toEqual([]);
    // Consensi: array con 3 canali, tutti 0
    expect(a.consentsByChannel.length).toBe(3);
    a.consentsByChannel.forEach((c) => {
      expect(c.granted).toBe(0);
      expect(c.revoked).toBe(0);
      expect(c.never).toBe(0);
    });
  });

  it("getOrdersAnalytics org vuota → AOV 0, no divisione per zero", async () => {
    const a = await getOrdersAnalytics(emptyOrgId, "30d");
    expect(a.countInPeriod).toBe(0);
    expect(a.totalCentsInPeriod).toBe(0);
    expect(a.avgOrderValueCents).toBe(0);
    expect(a.byChannel).toEqual([]);
    expect(a.byStatus).toEqual([]);
  });

  it("getLoyaltyAnalytics org vuota → tassi 0, no divisione per zero", async () => {
    const a = await getLoyaltyAnalytics(emptyOrgId);
    expect(a.vouchersActive).toBe(0);
    expect(a.vouchersRedeemed).toBe(0);
    expect(a.redemptionRatePct).toBe(0);
    expect(a.expiringNext7d).toBe(0);
    expect(a.topProgressingContacts).toEqual([]);
  });

  it("getOutreachAnalytics org vuota → contatori zero + lastCampaign null", async () => {
    const a = await getOutreachAnalytics(emptyOrgId);
    expect(a.activeSegments).toBe(0);
    expect(a.totalSegmentedContacts).toBe(0);
    expect(a.campaignsDraft).toBe(0);
    expect(a.campaignsScheduled).toBe(0);
    expect(a.campaignsSent).toBe(0);
    expect(a.lastCampaignSent).toBeNull();
  });

  it("getPartnersAnalytics org vuota → tutti zero, byStatus vuoto", async () => {
    const a = await getPartnersAnalytics(emptyOrgId);
    expect(a.totalActive).toBe(0);
    expect(a.cooling).toBe(0);
    expect(a.toContact).toBe(0);
    expect(a.byStatus).toEqual([]);
  });

  it("getSignupAnalytics org vuota → tutti zero, byLanding vuoto", async () => {
    const a = await getSignupAnalytics(emptyOrgId, "30d");
    expect(a.totalEventsInPeriod).toBe(0);
    expect(a.totalEventsPreviousPeriod).toBe(0);
    expect(a.vouchersEmitted).toBe(0);
    expect(a.byLanding).toEqual([]);
  });
});
