// RN-28 Invariante soglia errori consegna: alertLevel ok (0-1) / warn (2) / alert (>=3).
//
// Verifica che getPartnerErrorsSummary classifichi correttamente i partner in
// base al conteggio ultimi 30gg. 3+ errori = allarme rosso sulla card lista.

import { describe, expect, it, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getPartnerErrorsSummary } from "@/modules/m07-partners/public";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");
}
const admin: SupabaseClient = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function createTestPartner(name: string): Promise<string> {
  const { data: brand } = await admin
    .from("brands")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("slug", "lenny")
    .maybeSingle();
  const brandId = (brand as { id: string }).id;
  const { data } = await admin
    .from("partner_restaurants")
    .insert({
      organization_id: ORG_ID,
      brand_id: brandId,
      name,
      onboarding_status: "attivo",
      cuisine_category: "pizzeria",
      address_cap: "47899",
    })
    .select("id")
    .single();
  return (data as { id: string }).id;
}

async function addError(
  partnerId: string,
  daysAgo: number,
  severity: "bassa" | "media" | "alta",
): Promise<void> {
  const occurredAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
  await admin.from("partner_delivery_errors").insert({
    organization_id: ORG_ID,
    partner_id: partnerId,
    reason: `test error ${severity} ${daysAgo}gg fa`,
    severity,
    occurred_at: occurredAt,
  });
}

describe("RN-28 · partner_delivery_errors soglia alertLevel", () => {
  const partnerIds: string[] = [];

  afterAll(async () => {
    // Cleanup CASCADE
    for (const id of partnerIds) {
      await admin.from("partner_restaurants").delete().eq("id", id);
    }
  });

  it("0 errori 30gg → alertLevel='ok'", async () => {
    const id = await createTestPartner(`test-ok-${Date.now()}`);
    partnerIds.push(id);
    const summary = await getPartnerErrorsSummary(ORG_ID, id);
    expect(summary.alertLevel).toBe("ok");
    expect(summary.countLast30d).toBe(0);
  });

  it("1 errore 30gg → alertLevel='ok' (fisiologico)", async () => {
    const id = await createTestPartner(`test-ok1-${Date.now()}`);
    partnerIds.push(id);
    await addError(id, 5, "bassa");
    const summary = await getPartnerErrorsSummary(ORG_ID, id);
    expect(summary.alertLevel).toBe("ok");
    expect(summary.countLast30d).toBe(1);
  });

  it("2 errori 30gg → alertLevel='warn'", async () => {
    const id = await createTestPartner(`test-warn-${Date.now()}`);
    partnerIds.push(id);
    await addError(id, 5, "bassa");
    await addError(id, 15, "media");
    const summary = await getPartnerErrorsSummary(ORG_ID, id);
    expect(summary.alertLevel).toBe("warn");
    expect(summary.countLast30d).toBe(2);
  });

  it("3+ errori 30gg → alertLevel='alert' (RN-28 soglia allarme)", async () => {
    const id = await createTestPartner(`test-alert-${Date.now()}`);
    partnerIds.push(id);
    await addError(id, 5, "alta");
    await addError(id, 15, "media");
    await addError(id, 25, "bassa");
    const summary = await getPartnerErrorsSummary(ORG_ID, id);
    expect(summary.alertLevel).toBe("alert");
    expect(summary.countLast30d).toBe(3);
  });

  it("errori > 30gg non contano nella finestra 30gg attuale", async () => {
    const id = await createTestPartner(`test-old-${Date.now()}`);
    partnerIds.push(id);
    // 3 errori oltre i 30gg → non devono entrare nel count last30d
    await addError(id, 35, "alta");
    await addError(id, 50, "media");
    await addError(id, 60, "bassa");
    const summary = await getPartnerErrorsSummary(ORG_ID, id);
    expect(summary.alertLevel).toBe("ok");
    expect(summary.countLast30d).toBe(0);
    expect(summary.countPrevious30d).toBeGreaterThan(0);
  });
});
