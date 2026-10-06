// M08 — RF-9.3 attribuzione contenuto -> vendita (voucher).
// Legge vouchers.source_draft_id (nullable) e aggrega per draft, join su
// content_drafts per titolo/data/brand. Fornisce la vista "quale post ha
// prodotto quanti riscatti" per il cruscotto /analytics.

import { getAdminClient } from "@/lib/db/admin";

export type DraftAttribution = {
  draftId: string;
  draftTitle: string;
  brandId: string;
  brandDisplayName: string;
  topicLabel: string | null;
  firstIssuedAt: string | null;
  lastRedeemedAt: string | null;
  totalIssued: number;
  totalRedeemed: number;
  totalExpired: number;
  totalCancelled: number;
  redemptionRatePct: number;
};

export type AttributionSummary = {
  totalIssuedAttributed: number;
  totalRedeemedAttributed: number;
  totalIssuedUnattributed: number;
  totalRedeemedUnattributed: number;
  attributionCoveragePct: number; // issued attribuiti / issued totali
  byDraft: DraftAttribution[];
};

export async function getAttributionByDraft(
  organizationId: string,
  options: { limit?: number } = {},
): Promise<AttributionSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // 1) tutti i voucher con source_draft_id (attribuiti)
  const { data: attributed, error: errA } = await admin
    .from("vouchers")
    .select(
      "source_draft_id, status, issued_at, redeemed_at, content_drafts!inner(id, theme_input, brand_id, topic_label, brands!inner(display_name))",
    )
    .eq("organization_id", organizationId)
    .not("source_draft_id", "is", null);
  if (errA) throw new Error(`attribuzione lookup: ${errA.message}`);

  // 2) counts totali vs attribuiti per il rapporto di copertura
  const [totalIssuedRes, totalRedeemedRes] = await Promise.all([
    admin
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["issued", "redeemed", "expired", "cancelled"]),
    admin
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "redeemed"),
  ]);
  if (totalIssuedRes.error) throw new Error(`attribution totals: ${totalIssuedRes.error.message}`);
  if (totalRedeemedRes.error)
    throw new Error(`attribution totals: ${totalRedeemedRes.error.message}`);

  const totalIssued = totalIssuedRes.count ?? 0;
  const totalRedeemed = totalRedeemedRes.count ?? 0;

  // Aggrega per source_draft_id
  type Row = {
    source_draft_id: string;
    status: string;
    issued_at: string;
    redeemed_at: string | null;
    content_drafts: {
      id: string;
      theme_input: string;
      brand_id: string;
      topic_label: string | null;
      brands: { display_name: string };
    };
  };
  const map = new Map<string, DraftAttribution>();
  for (const r of (attributed ?? []) as Row[]) {
    const key = r.source_draft_id;
    const d = r.content_drafts;
    const existing = map.get(key);
    if (existing) {
      existing.totalIssued += 1;
      if (r.status === "redeemed") existing.totalRedeemed += 1;
      if (r.status === "expired") existing.totalExpired += 1;
      if (r.status === "cancelled") existing.totalCancelled += 1;
      if (r.issued_at && (!existing.firstIssuedAt || r.issued_at < existing.firstIssuedAt)) {
        existing.firstIssuedAt = r.issued_at;
      }
      if (r.redeemed_at && (!existing.lastRedeemedAt || r.redeemed_at > existing.lastRedeemedAt)) {
        existing.lastRedeemedAt = r.redeemed_at;
      }
    } else {
      map.set(key, {
        draftId: d.id,
        draftTitle: d.theme_input,
        brandId: d.brand_id,
        brandDisplayName: d.brands.display_name,
        topicLabel: d.topic_label ?? null,
        firstIssuedAt: r.issued_at,
        lastRedeemedAt: r.status === "redeemed" ? r.redeemed_at : null,
        totalIssued: 1,
        totalRedeemed: r.status === "redeemed" ? 1 : 0,
        totalExpired: r.status === "expired" ? 1 : 0,
        totalCancelled: r.status === "cancelled" ? 1 : 0,
        redemptionRatePct: 0,
      });
    }
  }

  const byDraft = Array.from(map.values()).map((d) => ({
    ...d,
    redemptionRatePct: d.totalIssued > 0 ? Math.round((d.totalRedeemed / d.totalIssued) * 100) : 0,
  }));
  byDraft.sort((a, b) => b.totalRedeemed - a.totalRedeemed || b.totalIssued - a.totalIssued);
  const limited = options.limit ? byDraft.slice(0, options.limit) : byDraft;

  const totalIssuedAttributed = byDraft.reduce((s, d) => s + d.totalIssued, 0);
  const totalRedeemedAttributed = byDraft.reduce((s, d) => s + d.totalRedeemed, 0);
  const attributionCoveragePct =
    totalIssued > 0 ? Math.round((totalIssuedAttributed / totalIssued) * 100) : 0;

  return {
    totalIssuedAttributed,
    totalRedeemedAttributed,
    totalIssuedUnattributed: Math.max(0, totalIssued - totalIssuedAttributed),
    totalRedeemedUnattributed: Math.max(0, totalRedeemed - totalRedeemedAttributed),
    attributionCoveragePct,
    byDraft: limited,
  };
}
