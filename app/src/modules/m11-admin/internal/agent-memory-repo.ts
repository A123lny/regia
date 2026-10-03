// RA-8.11 Memoria agente — aggregatore read-only.
// Mostra correzioni ricevute, motivi di rifiuto, esiti promozioni, preferenze
// di stile. Serve per capire se l'AI sta migliorando o ripete gli stessi errori.
// Nessuna nuova tabella: aggrega dati gia' presenti (content_drafts, vouchers,
// voucher_offers, brand_pillars).
//
// La memoria risiede nel DB (RNF-8): un cambio di modello AI non la perde.

import { getAdminClient } from "@/lib/db/admin";

const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;

export type ApprovalStat = {
  topicLabel: string | null;
  totalDrafts: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number; // 0..1
};

/**
 * Approval rate per topic_label negli ultimi 90gg.
 * Lega RA-8.3: 9/10 approva senza modifica -> propone passaggio di livello.
 */
export async function getApprovalStatsByTopic(organizationId: string): Promise<ApprovalStat[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const since = new Date(Date.now() - DAYS_90_MS).toISOString();
  const { data, error } = await admin
    .from("content_drafts")
    .select("topic_label, status")
    .eq("organization_id", organizationId)
    .gte("created_at", since);
  if (error) throw new Error(`getApprovalStatsByTopic: ${error.message}`);

  const grouped = new Map<
    string | null,
    { total: number; approved: number; rejected: number; pending: number }
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const key = (r.topic_label as string | null) ?? null;
    const prev = grouped.get(key) ?? { total: 0, approved: 0, rejected: 0, pending: 0 };
    prev.total += 1;
    const s = r.status as string;
    if (s === "approved" || s === "scheduled" || s === "published") prev.approved += 1;
    else if (s === "rejected") prev.rejected += 1;
    else prev.pending += 1;
    grouped.set(key, prev);
  }
  return Array.from(grouped.entries())
    .map(([topic, stats]): ApprovalStat => ({
      topicLabel: topic,
      totalDrafts: stats.total,
      approved: stats.approved,
      rejected: stats.rejected,
      pending: stats.pending,
      approvalRate: stats.total > 0 ? stats.approved / stats.total : 0,
    }))
    .sort((a, b) => b.totalDrafts - a.totalDrafts);
}

export type RejectionReason = {
  draftId: string;
  brandId: string;
  brandDisplayName: string;
  topicLabel: string | null;
  rejectedAt: string;
  reason: string;
};

/**
 * Motivi di rifiuto piu' recenti (ultimi 90gg). Tagliati a 50 per non esplodere UI.
 */
export async function getRecentRejections(
  organizationId: string,
  limit = 50,
): Promise<RejectionReason[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const since = new Date(Date.now() - DAYS_90_MS).toISOString();
  const { data, error } = await admin
    .from("content_drafts")
    .select("id, brand_id, topic_label, rejected_at, rejection_reason, brands!inner(display_name)")
    .eq("organization_id", organizationId)
    .eq("status", "rejected")
    .gte("rejected_at", since)
    .not("rejection_reason", "is", null)
    .order("rejected_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentRejections: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r): RejectionReason => ({
    draftId: r.id as string,
    brandId: r.brand_id as string,
    brandDisplayName: r.brands.display_name as string,
    topicLabel: (r.topic_label as string | null) ?? null,
    rejectedAt: r.rejected_at as string,
    reason: r.rejection_reason as string,
  }));
}

export type RejectionTheme = {
  keyword: string;
  occurrences: number;
};

/**
 * Analisi parole chiave ricorrenti nei motivi di rifiuto: raggruppa le parole
 * significative (>3 char, non stop-word italiane) per capire cosa va storto
 * sistematicamente.
 */
export function extractRejectionThemes(reasons: RejectionReason[]): RejectionTheme[] {
  const STOP_WORDS = new Set([
    "con",
    "per",
    "una",
    "uno",
    "nel",
    "nella",
    "del",
    "della",
    "dei",
    "delle",
    "non",
    "che",
    "sono",
    "stato",
    "stata",
    "come",
    "piu",
    "troppo",
    "troppa",
    "molto",
    "molta",
    "quando",
    "dove",
    "mentre",
    "anche",
    "cioe",
    "pero",
    "quindi",
    "senza",
    "sopra",
    "sotto",
    "oltre",
  ]);
  const counter = new Map<string, number>();
  for (const r of reasons) {
    const tokens = r.reason
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
    for (const t of tokens) {
      counter.set(t, (counter.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counter.entries())
    .map(([keyword, occurrences]): RejectionTheme => ({ keyword, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 15);
}

export type PromoOutcome = {
  offerId: string;
  offerName: string;
  brandDisplayName: string;
  issued: number;
  redeemed: number;
  expired: number;
  cancelled: number;
  redemptionRate: number; // redeemed / issued
};

/**
 * Esiti promozioni: per ogni offer, quanti voucher emessi/riscattati/scaduti.
 * Insight chiave: redemption_rate basso = offerta non attrattiva o canale sbagliato.
 */
export async function getPromoOutcomes(organizationId: string): Promise<PromoOutcome[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("vouchers")
    .select(
      "offer_id, status, voucher_offers!inner(name, issuer_brand_id, brands!voucher_offers_issuer_brand_id_fkey(display_name))",
    )
    .eq("organization_id", organizationId);
  if (error) throw new Error(`getPromoOutcomes: ${error.message}`);

  const grouped = new Map<
    string,
    {
      offerId: string;
      offerName: string;
      brandDisplayName: string;
      issued: number;
      redeemed: number;
      expired: number;
      cancelled: number;
    }
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const key = r.offer_id as string;
    const prev = grouped.get(key) ?? {
      offerId: key,
      offerName: r.voucher_offers.name as string,
      brandDisplayName: r.voucher_offers.brands?.display_name ?? "—",
      issued: 0,
      redeemed: 0,
      expired: 0,
      cancelled: 0,
    };
    prev.issued += 1;
    if (r.status === "redeemed") prev.redeemed += 1;
    else if (r.status === "expired") prev.expired += 1;
    else if (r.status === "cancelled") prev.cancelled += 1;
    grouped.set(key, prev);
  }
  return Array.from(grouped.values())
    .map((v): PromoOutcome => ({
      ...v,
      redemptionRate: v.issued > 0 ? v.redeemed / v.issued : 0,
    }))
    .sort((a, b) => b.issued - a.issued);
}

export type BrandStylePreference = {
  brandId: string;
  brandDisplayName: string;
  pillars: Array<{ name: string; weight: number }>;
  forbiddenCount: number;
  sensitiveTopicsCount: number;
};

/**
 * Preferenze di stile per marchio: pilastri narrativi con peso attuale,
 * parole vietate, argomenti sensibili. Riflesso di cosa il titolare preferisce
 * e cosa l'AI deve ricordare in generazione.
 */
export async function getBrandStylePreferences(
  organizationId: string,
): Promise<BrandStylePreference[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: brands, error: bErr } = await admin
    .from("brands")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .order("display_name");
  if (bErr) throw new Error(`getBrandStylePreferences brands: ${bErr.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (brands ?? []) as any[];
  const results: BrandStylePreference[] = [];
  for (const b of list) {
    const [pillars, forbidden, sensitive] = await Promise.all([
      admin
        .from("brand_pillars")
        .select("name, weight")
        .eq("brand_id", b.id)
        .order("weight", { ascending: false })
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("brand_forbidden_words")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", b.id)
        .then((r: { count: number | null }) => r.count ?? 0),
      admin
        .from("brand_sensitive_topics")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", b.id)
        .then((r: { count: number | null }) => r.count ?? 0),
    ]);
    results.push({
      brandId: b.id as string,
      brandDisplayName: b.display_name as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pillars: ((pillars as any[]) ?? []).map((p) => ({
        name: p.name as string,
        weight: Number(p.weight ?? 0),
      })),
      forbiddenCount: Number(forbidden ?? 0),
      sensitiveTopicsCount: Number(sensitive ?? 0),
    });
  }
  return results;
}
