// RN-37/38/39 Analisi di mercato della rete per categoria.
//
// Capitolato: "Il problema della rete non e' chi va male, e' quanti fanno la
// stessa cosa: il sistema indica quali categorie sono sature e quali mancano
// rispetto alla domanda. E' una decisione da gestore di mercato, non da
// marketing."
//
// Scope F1 (senza connettori M1 reali, molti conteggi 0): aggrega ristoranti
// per cuisine_category, calcola rapporto ordini/ristorante, confronta con la
// mediana rete, suggerisce "satura" / "sotto-offerta" / "in linea".

import { getAdminClient } from "@/lib/db/admin";

export type MarketCategoryRow = {
  category: string;
  partnerCount: number; // ristoranti attivi in questa categoria
  totalOrdersLast90d: number;
  avgOrdersPerPartner: number; // ordini totali / partner, arrotondato
  avgPrepMinutes: number | null; // media sui partner con tempo valorizzato
  coolingCount: number; // partner con cooling_flag
  // vs mediana rete:
  position: "high" | "in_line" | "low"; // sopra 1.15× / entro ±15% / sotto 0.85×
  recommendation: "satura" | "sotto_offerta" | "equilibrata" | "sconosciuta";
};

export type MarketAnalysis = {
  totalPartners: number;
  totalCategories: number;
  totalOrders: number;
  medianAvgOrdersPerPartner: number;
  rows: MarketCategoryRow[];
};

export async function analyzeMarketByCategory(organizationId: string): Promise<MarketAnalysis> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // 1) tutti i partner attivi (non archiviati) con categoria
  const { data: partners, error: errP } = await admin
    .from("partner_restaurants")
    .select("id, cuisine_category, avg_prep_minutes, cooling_flag, onboarding_status")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .not("cuisine_category", "is", null);
  if (errP) throw new Error(`market analysis partners: ${errP.message}`);

  type P = {
    id: string;
    cuisine_category: string;
    avg_prep_minutes: number | null;
    cooling_flag: boolean;
    onboarding_status: string;
  };
  const rows = (partners ?? []) as P[];

  if (rows.length === 0) {
    return {
      totalPartners: 0,
      totalCategories: 0,
      totalOrders: 0,
      medianAvgOrdersPerPartner: 0,
      rows: [],
    };
  }

  // 2) ordini ultimi 90gg per partner_restaurant_id (attribuiti)
  const partnerIds = rows.map((p) => p.id);
  const { data: orderRows, error: errO } = await admin
    .from("brand_orders")
    .select("partner_restaurant_id")
    .eq("organization_id", organizationId)
    .in("partner_restaurant_id", partnerIds)
    .in("status", ["completed", "pending"])
    .gte("placed_at", ninetyDaysAgo);
  if (errO) throw new Error(`market analysis orders: ${errO.message}`);

  const ordersByPartner = new Map<string, number>();
  for (const r of (orderRows ?? []) as { partner_restaurant_id: string }[]) {
    ordersByPartner.set(
      r.partner_restaurant_id,
      (ordersByPartner.get(r.partner_restaurant_id) ?? 0) + 1,
    );
  }

  // 3) raggruppa per categoria
  type CatAgg = {
    partners: P[];
    totalOrders: number;
  };
  const byCategory = new Map<string, CatAgg>();
  for (const p of rows) {
    const cat = p.cuisine_category;
    const agg = byCategory.get(cat) ?? { partners: [], totalOrders: 0 };
    agg.partners.push(p);
    agg.totalOrders += ordersByPartner.get(p.id) ?? 0;
    byCategory.set(cat, agg);
  }

  // 4) calcola mediana ordini/partner su tutte le categorie con >=1 ristorante
  const avgPerPartnerByCategory: Array<{ category: string; avg: number }> = [];
  for (const [cat, agg] of byCategory) {
    const avg = agg.partners.length > 0 ? agg.totalOrders / agg.partners.length : 0;
    avgPerPartnerByCategory.push({ category: cat, avg });
  }
  const sortedAvgs = avgPerPartnerByCategory.map((x) => x.avg).sort((a, b) => a - b);
  const mid = Math.floor(sortedAvgs.length / 2);
  const medianAvg =
    sortedAvgs.length === 0
      ? 0
      : sortedAvgs.length % 2 === 0
        ? ((sortedAvgs[mid - 1] ?? 0) + (sortedAvgs[mid] ?? 0)) / 2
        : (sortedAvgs[mid] ?? 0);

  // 5) costruisci rows finali
  const resultRows: MarketCategoryRow[] = [];
  for (const [cat, agg] of byCategory) {
    const avg = agg.partners.length > 0 ? agg.totalOrders / agg.partners.length : 0;
    const prepMinutes = agg.partners
      .map((p) => p.avg_prep_minutes)
      .filter((v): v is number => typeof v === "number");
    const avgPrep =
      prepMinutes.length > 0
        ? Math.round(prepMinutes.reduce((s, n) => s + n, 0) / prepMinutes.length)
        : null;
    const coolingCount = agg.partners.filter((p) => p.cooling_flag).length;

    let position: MarketCategoryRow["position"] = "in_line";
    let recommendation: MarketCategoryRow["recommendation"] = "equilibrata";
    if (medianAvg === 0) {
      recommendation = "sconosciuta";
    } else {
      const ratio = avg / medianAvg;
      if (ratio >= 1.15) {
        position = "high";
        // Molti ordini per partner: domanda forte, non satura
        recommendation = "sotto_offerta";
      } else if (ratio <= 0.85) {
        position = "low";
        // Pochi ordini per partner: troppi ristoranti per la domanda
        recommendation = "satura";
      }
    }

    resultRows.push({
      category: cat,
      partnerCount: agg.partners.length,
      totalOrdersLast90d: agg.totalOrders,
      avgOrdersPerPartner: Math.round(avg * 10) / 10,
      avgPrepMinutes: avgPrep,
      coolingCount,
      position,
      recommendation,
    });
  }

  // Ordina: prima le "sotto_offerta" (opportunita'), poi equilibrate, poi sature
  const order: Record<MarketCategoryRow["recommendation"], number> = {
    sotto_offerta: 0,
    equilibrata: 1,
    satura: 2,
    sconosciuta: 3,
  };
  resultRows.sort((a, b) => {
    const d = order[a.recommendation] - order[b.recommendation];
    if (d !== 0) return d;
    return b.totalOrdersLast90d - a.totalOrdersLast90d;
  });

  return {
    totalPartners: rows.length,
    totalCategories: byCategory.size,
    totalOrders: Array.from(byCategory.values()).reduce((s, a) => s + a.totalOrders, 0),
    medianAvgOrdersPerPartner: Math.round(medianAvg * 10) / 10,
    rows: resultRows,
  };
}
