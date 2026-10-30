// RF-6.9 M06+M08 — "il valore scorre tra marchi, paga chi riceve".
//
// Aggregator cross-brand: raggruppa voucher per (issuer_brand, spendable_brand)
// SOLO quando issuer != spendable. Calcola count issuati/riscattati/scaduti +
// costo stimato per lo spendable (chi riceve il nuovo cliente).

import { getAdminClient } from "@/lib/db/admin";
import {
  PERIOD_DAYS,
  type AnalyticsPeriod,
  type CrossBrandAnalytics,
  type CrossBrandFlow,
} from "./analytics-types";

type VoucherRow = {
  id: string;
  status: "issued" | "redeemed" | "expired" | "cancelled";
  contact_id: string;
  reward_kind: "valore_fisso" | "percentuale" | "servizio_gratis";
  reward_value_cents: number | null;
  reward_pct: number | null;
  redeemed_by_order_id: string | null;
  issued_at: string;
  redeemed_at: string | null;
  offer: {
    issuer_brand_id: string;
    spendable_brand_id: string;
    issuer: { id: string; display_name: string } | null;
    spendable: { id: string; display_name: string } | null;
  } | null;
};

export async function getCrossBrandFlow(
  organizationId: string,
  period: AnalyticsPeriod = "30d",
): Promise<CrossBrandAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const sinceIso = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 3600 * 1000).toISOString();

  // 1. Carica voucher nel periodo con join su offer + brands.
  // Filtra client-side su offer.issuer != offer.spendable (JOIN condition difficile in PostgREST).
  const { data: vouchers, error } = await admin
    .from("vouchers")
    .select(
      `id, status, contact_id, reward_kind, reward_value_cents, reward_pct, redeemed_by_order_id, issued_at, redeemed_at,
       offer:voucher_offers!vouchers_offer_id_fkey (
         issuer_brand_id,
         spendable_brand_id,
         issuer:brands!voucher_offers_issuer_brand_id_fkey (id, display_name),
         spendable:brands!voucher_offers_spendable_brand_id_fkey (id, display_name)
       )`,
    )
    .eq("organization_id", organizationId)
    .gte("issued_at", sinceIso);
  if (error) throw new Error(`cross-brand voucher fetch: ${error.message}`);

  const rows = (vouchers ?? []) as VoucherRow[];
  const crossBrand = rows.filter(
    (v) => v.offer !== null && v.offer.issuer_brand_id !== v.offer.spendable_brand_id,
  );

  // 2. Per i voucher 'percentuale' + redeemed, servono i totali degli ordini di riscatto.
  const orderIds = crossBrand
    .filter((v) => v.reward_kind === "percentuale" && v.redeemed_by_order_id !== null)
    .map((v) => v.redeemed_by_order_id!)
    .filter((id, i, arr) => arr.indexOf(id) === i); // dedupe
  let orderTotals = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: orders, error: oErr } = await admin
      .from("brand_orders")
      .select("id, total_cents")
      .in("id", orderIds);
    if (oErr) throw new Error(`cross-brand orders fetch: ${oErr.message}`);
    orderTotals = new Map(
      ((orders ?? []) as { id: string; total_cents: number }[]).map((o) => [o.id, o.total_cents]),
    );
  }

  // 3. Aggrega per coppia (issuer, spendable).
  type Bucket = {
    issuerBrandId: string;
    issuerBrandName: string;
    spendableBrandId: string;
    spendableBrandName: string;
    issued: number;
    redeemed: number;
    expired: number;
    costCents: number;
    distinctContacts: Set<string>;
  };
  const bucketKey = (iss: string, sp: string) => `${iss}:${sp}`;
  const buckets = new Map<string, Bucket>();

  for (const v of crossBrand) {
    const offer = v.offer!;
    const key = bucketKey(offer.issuer_brand_id, offer.spendable_brand_id);
    let b = buckets.get(key);
    if (!b) {
      b = {
        issuerBrandId: offer.issuer_brand_id,
        issuerBrandName: offer.issuer?.display_name ?? offer.issuer_brand_id,
        spendableBrandId: offer.spendable_brand_id,
        spendableBrandName: offer.spendable?.display_name ?? offer.spendable_brand_id,
        issued: 0,
        redeemed: 0,
        expired: 0,
        costCents: 0,
        distinctContacts: new Set(),
      };
      buckets.set(key, b);
    }
    b.issued += 1;
    if (v.status === "redeemed") {
      b.redeemed += 1;
      b.distinctContacts.add(v.contact_id);
      if (v.reward_kind === "valore_fisso" && v.reward_value_cents !== null) {
        b.costCents += v.reward_value_cents;
      } else if (
        v.reward_kind === "percentuale" &&
        v.reward_pct !== null &&
        v.redeemed_by_order_id !== null
      ) {
        const orderTotal = orderTotals.get(v.redeemed_by_order_id) ?? 0;
        b.costCents += Math.round((orderTotal * v.reward_pct) / 100);
      }
      // reward_kind='servizio_gratis' non quantificabile → solo count.
    } else if (v.status === "expired") {
      b.expired += 1;
    }
  }

  const flows: CrossBrandFlow[] = Array.from(buckets.values())
    .map((b) => ({
      issuerBrandId: b.issuerBrandId,
      issuerBrandName: b.issuerBrandName,
      spendableBrandId: b.spendableBrandId,
      spendableBrandName: b.spendableBrandName,
      vouchersIssued: b.issued,
      vouchersRedeemed: b.redeemed,
      vouchersExpired: b.expired,
      estimatedCostCentsRedeemed: b.costCents,
      distinctContactsRedeemed: b.distinctContacts.size,
    }))
    .sort((a, b) => b.vouchersRedeemed - a.vouchersRedeemed);

  const totalIssuedCrossBrand = flows.reduce((s, f) => s + f.vouchersIssued, 0);
  const totalRedeemedCrossBrand = flows.reduce((s, f) => s + f.vouchersRedeemed, 0);
  const totalEstimatedCostCents = flows.reduce((s, f) => s + f.estimatedCostCentsRedeemed, 0);

  return {
    flows,
    totalIssuedCrossBrand,
    totalRedeemedCrossBrand,
    totalEstimatedCostCents,
  };
}
