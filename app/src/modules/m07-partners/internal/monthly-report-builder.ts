// RN-47 Report mensile automatico ai ristoratori.
// Capitolato: "andamento vs mese precedente, piatti top, posizione rispetto
// alla media categoria". In F1, senza connettori M1 reali, molte metriche
// restano a zero: diamo quello che abbiamo (attivita' M07 + stato relazione +
// voucher attivi) e lasciamo il frame pronto per quando i connettori arrivano.

import { getAdminClient } from "@/lib/db/admin";

export type MonthlyPartnerReport = {
  partnerId: string;
  partnerName: string;
  referentName: string | null;
  cuisineCategory: string | null;
  // Mese analizzato (ISO date del primo giorno)
  monthStartIso: string;
  monthLabel: string; // "ottobre 2026"

  // Ordini (dai connettori M1 reali — oggi 0 se mai popolati)
  ordersThisMonth: number;
  ordersPrevMonth: number;
  ordersDeltaPct: number | null; // null se prev = 0
  revenueCentsThisMonth: number;
  revenuePrevMonth: number;
  categoryMedianOrders: number | null; // mediana categoria nel mese
  positionVsCategory: "above" | "below" | "in_line" | "no_data";

  // Attivita' M07 nel mese (chiamate/incontri con il partner)
  activitiesCount: number;
  activitiesPrevCount: number;
  lastContactDaysAgo: number | null;
  coolingActive: boolean;

  // Voucher attivi spendibili sui prodotti del brand del partner
  activeVouchersForBrand: number;
};

/**
 * Costruisce il report per un singolo partner e un mese specifico.
 * monthIso: data qualsiasi del mese target (viene normalizzata al 1° giorno).
 */
export async function buildMonthlyPartnerReport(
  organizationId: string,
  partnerId: string,
  monthIso: string = new Date().toISOString(),
): Promise<MonthlyPartnerReport | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Carica il partner
  const { data: partner, error: errP } = await admin
    .from("partner_restaurants")
    .select("id, brand_id, name, referent_name, cuisine_category, last_contact_at, cooling_flag")
    .eq("id", partnerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (errP) throw new Error(`report builder partner: ${errP.message}`);
  if (!partner) return null;

  // Calcola le finestre del mese target e del mese precedente
  const target = new Date(monthIso);
  const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
  const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 1);
  const prevStart = new Date(target.getFullYear(), target.getMonth() - 1, 1);
  const prevEnd = monthStart;

  // Ordini attribuiti nel mese + mese precedente
  const [ordersThis, ordersPrev] = await Promise.all([
    admin
      .from("brand_orders")
      .select("total_cents", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("partner_restaurant_id", partnerId)
      .in("status", ["completed", "pending"])
      .gte("placed_at", monthStart.toISOString())
      .lt("placed_at", monthEnd.toISOString()),
    admin
      .from("brand_orders")
      .select("total_cents", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("partner_restaurant_id", partnerId)
      .in("status", ["completed", "pending"])
      .gte("placed_at", prevStart.toISOString())
      .lt("placed_at", prevEnd.toISOString()),
  ]);
  if (ordersThis.error) throw new Error(`report builder orders this: ${ordersThis.error.message}`);
  if (ordersPrev.error) throw new Error(`report builder orders prev: ${ordersPrev.error.message}`);

  type OrderRow = { total_cents: number };
  const revenueCentsThisMonth = ((ordersThis.data ?? []) as OrderRow[]).reduce(
    (s, r) => s + (r.total_cents ?? 0),
    0,
  );
  const revenuePrevMonth = ((ordersPrev.data ?? []) as OrderRow[]).reduce(
    (s, r) => s + (r.total_cents ?? 0),
    0,
  );
  const ordersThisMonth = ordersThis.count ?? 0;
  const ordersPrevMonthCount = ordersPrev.count ?? 0;
  const ordersDeltaPct =
    ordersPrevMonthCount > 0
      ? Math.round(((ordersThisMonth - ordersPrevMonthCount) / ordersPrevMonthCount) * 100)
      : null;

  // Mediana categoria: ordini per partner con stessa cuisine_category nel mese
  let categoryMedianOrders: number | null = null;
  let positionVsCategory: MonthlyPartnerReport["positionVsCategory"] = "no_data";
  if (partner.cuisine_category) {
    const { data: catPartners, error: errCat } = await admin
      .from("partner_restaurants")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("cuisine_category", partner.cuisine_category)
      .is("archived_at", null);
    if (errCat) throw new Error(`report builder category: ${errCat.message}`);
    const ids = ((catPartners ?? []) as { id: string }[]).map((p) => p.id);
    if (ids.length >= 2) {
      // Conta ordini del mese per ciascun partner della categoria
      const { data: catOrders, error: errOrders } = await admin
        .from("brand_orders")
        .select("partner_restaurant_id")
        .eq("organization_id", organizationId)
        .in("partner_restaurant_id", ids)
        .in("status", ["completed", "pending"])
        .gte("placed_at", monthStart.toISOString())
        .lt("placed_at", monthEnd.toISOString());
      if (errOrders) throw new Error(`report builder category orders: ${errOrders.message}`);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, 0);
      for (const row of (catOrders ?? []) as { partner_restaurant_id: string }[]) {
        counts.set(row.partner_restaurant_id, (counts.get(row.partner_restaurant_id) ?? 0) + 1);
      }
      const values = Array.from(counts.values()).sort((a, b) => a - b);
      // Mediana
      const mid = Math.floor(values.length / 2);
      categoryMedianOrders =
        values.length % 2 === 0
          ? ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2
          : (values[mid] ?? 0);
      // Confronto (soglia ±10% per "in linea")
      if (categoryMedianOrders > 0) {
        const ratio = ordersThisMonth / categoryMedianOrders;
        if (ratio >= 1.1) positionVsCategory = "above";
        else if (ratio <= 0.9) positionVsCategory = "below";
        else positionVsCategory = "in_line";
      } else if (ordersThisMonth > 0) {
        positionVsCategory = "above";
      }
    }
  }

  // Attivita' M07 nel mese + mese precedente
  const [actThis, actPrev] = await Promise.all([
    admin
      .from("partner_activities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("partner_id", partnerId)
      .gte("occurred_at", monthStart.toISOString())
      .lt("occurred_at", monthEnd.toISOString()),
    admin
      .from("partner_activities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("partner_id", partnerId)
      .gte("occurred_at", prevStart.toISOString())
      .lt("occurred_at", prevEnd.toISOString()),
  ]);
  if (actThis.error) throw new Error(`report builder activities: ${actThis.error.message}`);
  if (actPrev.error) throw new Error(`report builder activities: ${actPrev.error.message}`);

  const lastContactDaysAgo = partner.last_contact_at
    ? Math.floor((Date.now() - new Date(partner.last_contact_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Voucher attivi sul brand del partner
  const nowIso = new Date().toISOString();
  const { data: voucherOffers } = await admin
    .from("voucher_offers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("spendable_brand_id", partner.brand_id)
    .eq("is_active", true);
  const offerIds = ((voucherOffers ?? []) as { id: string }[]).map((o) => o.id);
  let activeVouchersForBrand = 0;
  if (offerIds.length > 0) {
    const { count } = await admin
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("offer_id", offerIds)
      .eq("status", "issued")
      .gt("expires_at", nowIso);
    activeVouchersForBrand = count ?? 0;
  }

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    referentName: partner.referent_name ?? null,
    cuisineCategory: partner.cuisine_category ?? null,
    monthStartIso: monthStart.toISOString(),
    monthLabel: monthStart.toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    }),
    ordersThisMonth,
    ordersPrevMonth: ordersPrevMonthCount,
    ordersDeltaPct,
    revenueCentsThisMonth,
    revenuePrevMonth,
    categoryMedianOrders,
    positionVsCategory,
    activitiesCount: actThis.count ?? 0,
    activitiesPrevCount: actPrev.count ?? 0,
    lastContactDaysAgo,
    coolingActive: Boolean(partner.cooling_flag),
    activeVouchersForBrand,
  };
}

/**
 * Compone il messaggio WhatsApp (max ~400 char per restare sotto il limite
 * utility template Twilio). Tono: diretto, personale, numeri concreti.
 * Se non ci sono ordini attribuiti (connettori M1 non attivi), si fa un
 * messaggio di contatto che valorizza la relazione M07 attuale.
 */
export function formatMonthlyReportMessage(r: MonthlyPartnerReport): string {
  const greeting = r.referentName ? `Ciao ${r.referentName.split(" ")[0]}` : "Ciao";
  const monthStr = r.monthLabel;

  // Caso A: abbiamo ordini attribuiti → report "classico" col numero.
  if (r.ordersThisMonth > 0) {
    const deltaStr =
      r.ordersDeltaPct !== null
        ? ` (${r.ordersDeltaPct >= 0 ? "+" : ""}${r.ordersDeltaPct}% vs mese prec.)`
        : "";
    const positionStr =
      r.positionVsCategory === "above"
        ? ` Siete sopra la media ${r.cuisineCategory ?? "della categoria"}.`
        : r.positionVsCategory === "below"
          ? ` La media ${r.cuisineCategory ?? "della categoria"} e' ${r.categoryMedianOrders ?? "?"} ordini: insieme possiamo riallinearci.`
          : r.positionVsCategory === "in_line"
            ? ` Siete in linea con la media della categoria.`
            : "";
    const closing = r.coolingActive
      ? " Vorrei sentirti, se hai 10 min questa settimana."
      : " Grazie per la collaborazione!";
    return `${greeting}, report ${monthStr}: ${r.ordersThisMonth} ordini${deltaStr}.${positionStr}${closing}`;
  }

  // Caso B: nessun ordine attribuito (connettori off o partner mai partito).
  if (r.activitiesCount > 0) {
    return `${greeting}, aggiornamento ${monthStr}: ci siamo sentiti ${r.activitiesCount} volta/e questo mese${r.lastContactDaysAgo !== null ? ` (ultimo contatto ${r.lastContactDaysAgo}gg fa)` : ""}. ${r.activeVouchersForBrand > 0 ? `Ci sono ${r.activeVouchersForBrand} voucher attivi spendibili da voi.` : ""} Vorrei capire come posso darvi una mano in piu'.`;
  }

  // Caso C: ne' ordini ne' attivita' → rilancio relazione
  return `${greeting}, non ci siamo sentiti questo ${monthStr}. Mi piacerebbe fare un punto con te: come va il locale? Fammi sapere quando hai 10 min.`;
}
