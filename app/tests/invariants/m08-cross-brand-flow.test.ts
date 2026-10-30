// RF-6.9 M06+M08 — "paga chi riceve": voucher cross-brand (issuer != spendable)
// aggregati per coppia (emittente, spendibile) con count + costo stimato.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getCrossBrandFlow } from "@/modules/m08-analytics/public";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function getTwoDistinctBrandIds(): Promise<{ a: string; b: string }> {
  const { data } = await admin
    .from("brands")
    .select("id")
    .eq("organization_id", ORG_ID)
    .is("is_archived", false)
    .order("display_name")
    .limit(2);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length < 2) {
    throw new Error(
      "Servono almeno 2 marchi non archiviati per testare cross-brand (ne trovati " +
        rows.length +
        ")",
    );
  }
  return { a: rows[0]!.id, b: rows[1]!.id };
}

async function getOrCreateContactId(brandId: string): Promise<{ id: string; created: boolean }> {
  const { data } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", ORG_ID)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (data) return { id: (data as { id: string }).id, created: false };
  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      organization_id: ORG_ID,
      brand_id: brandId,
      first_name: "RF69",
      last_name: "Test",
      email: `rf69-test-${Date.now()}@test.local`,
      source: "manuale",
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert contact: ${error.message}`);
  return { id: (created as { id: string }).id, created: true };
}

describe("RF-6.9 · M08 cross-brand flow (paga chi riceve)", () => {
  const createdVoucherIds: string[] = [];
  const createdOfferIds: string[] = [];
  let brandA: string;
  let brandB: string;
  let contactId: string;
  let contactWasCreated = false;

  beforeAll(async () => {
    const brands = await getTwoDistinctBrandIds();
    brandA = brands.a;
    brandB = brands.b;
    const c = await getOrCreateContactId(brandA);
    contactId = c.id;
    contactWasCreated = c.created;
  });

  afterAll(async () => {
    for (const vid of createdVoucherIds) {
      await admin.from("vouchers").delete().eq("id", vid);
    }
    for (const oid of createdOfferIds) {
      await admin.from("voucher_offers").delete().eq("id", oid);
    }
    if (contactWasCreated && contactId) {
      await admin.from("contacts").delete().eq("id", contactId);
    }
  });

  async function createCrossBrandOffer(
    issuerBrandId: string,
    spendableBrandId: string,
  ): Promise<string> {
    const { data, error } = await admin
      .from("voucher_offers")
      .insert({
        organization_id: ORG_ID,
        issuer_brand_id: issuerBrandId,
        spendable_brand_id: spendableBrandId,
        name: `RF-6.9 test offer ${Date.now()}`,
        reward_kind: "valore_fisso",
        reward_value_cents: 500,
        default_expires_days: 60,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert offer: ${error.message}`);
    const id = (data as { id: string }).id;
    createdOfferIds.push(id);
    return id;
  }

  async function createVoucher(
    offerId: string,
    status: "issued" | "redeemed" | "expired",
  ): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
    const row: Record<string, unknown> = {
      organization_id: ORG_ID,
      offer_id: offerId,
      contact_id: contactId,
      code: `RF69-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      reward_kind: "valore_fisso",
      reward_value_cents: 500,
      status,
      issued_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    if (status === "redeemed") {
      row["redeemed_at"] = new Date().toISOString();
    }
    const { data, error } = await admin.from("vouchers").insert(row).select("id").single();
    if (error) throw new Error(`insert voucher: ${error.message}`);
    const id = (data as { id: string }).id;
    createdVoucherIds.push(id);
    return id;
  }

  it("coppia A → B con 2 emessi (1 redeemed, 1 issued) → flow aggregato", async () => {
    const offerId = await createCrossBrandOffer(brandA, brandB);
    await createVoucher(offerId, "issued");
    await createVoucher(offerId, "redeemed");

    const result = await getCrossBrandFlow(ORG_ID, "30d");
    const flow = result.flows.find(
      (f) => f.issuerBrandId === brandA && f.spendableBrandId === brandB,
    );
    expect(flow).toBeDefined();
    expect(flow!.vouchersIssued).toBeGreaterThanOrEqual(2);
    expect(flow!.vouchersRedeemed).toBeGreaterThanOrEqual(1);
    // Costo stimato ≥ 500 cent per il redeemed (reward valore_fisso)
    expect(flow!.estimatedCostCentsRedeemed).toBeGreaterThanOrEqual(500);
    expect(flow!.distinctContactsRedeemed).toBeGreaterThanOrEqual(1);
  });

  it("same-brand (issuer == spendable) NON compare nei flows", async () => {
    // Offer dove issuer == spendable: NON è cross-brand, non deve apparire
    const { data: offer, error } = await admin
      .from("voucher_offers")
      .insert({
        organization_id: ORG_ID,
        issuer_brand_id: brandA,
        spendable_brand_id: brandA,
        name: `RF-6.9 same-brand test ${Date.now()}`,
        reward_kind: "valore_fisso",
        reward_value_cents: 300,
        default_expires_days: 60,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert same-brand offer: ${error.message}`);
    const offerId = (offer as { id: string }).id;
    createdOfferIds.push(offerId);
    await createVoucher(offerId, "redeemed");

    const result = await getCrossBrandFlow(ORG_ID, "30d");
    const sameBrandFlow = result.flows.find(
      (f) => f.issuerBrandId === brandA && f.spendableBrandId === brandA,
    );
    expect(sameBrandFlow).toBeUndefined();
  });

  it("totali aggregati coerenti con somma dei flow", async () => {
    const result = await getCrossBrandFlow(ORG_ID, "30d");
    const sumIssued = result.flows.reduce((s, f) => s + f.vouchersIssued, 0);
    const sumRedeemed = result.flows.reduce((s, f) => s + f.vouchersRedeemed, 0);
    const sumCost = result.flows.reduce((s, f) => s + f.estimatedCostCentsRedeemed, 0);
    expect(result.totalIssuedCrossBrand).toBe(sumIssued);
    expect(result.totalRedeemedCrossBrand).toBe(sumRedeemed);
    expect(result.totalEstimatedCostCents).toBe(sumCost);
  });
});
