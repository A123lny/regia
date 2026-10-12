// RN-48 Workflow lancio nuovo ristorante.
// Un ristorante e' "in fase di lancio" nei primi 30gg dopo il passaggio a
// onboarding_status=attivo (campo launched_at). Durante quella finestra la
// UI mostra una card dedicata con contatore giorni + sorveglianza ordini
// vs mediana categoria. L'Owner decide cosa fare (contattare, promo, ecc.):
// il sistema non invia nulla da solo (§8.2 primo contatto mai autonomo).

import { getAdminClient } from "@/lib/db/admin";

export const LAUNCH_WINDOW_DAYS = 30;

export type PartnerLaunchStatus = {
  inLaunch: boolean;
  launchedAtIso: string | null;
  dayNum: number; // 1..30, 0 se non lanciato
  daysRemaining: number;
  ordersSoFar: number;
  categoryMedianAtWindow: number | null;
  targetOrders: number | null;
  underSurveillance: boolean; // true se ordersSoFar < target o < 70% mediana
  windowEndIso: string | null;
  reviewNotes: string | null;
};

/**
 * Calcola lo stato lancio di un partner. Null se partner non esiste o non ha
 * ancora launched_at (= mai andato attivo).
 */
export async function getPartnerLaunchStatus(
  organizationId: string,
  partnerId: string,
): Promise<PartnerLaunchStatus | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const { data: partner, error } = await admin
    .from("partner_restaurants")
    .select(
      "id, brand_id, launched_at, launch_target_orders, launch_review_notes, cuisine_category",
    )
    .eq("id", partnerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`launch status: ${error.message}`);
  if (!partner) return null;

  if (!partner.launched_at) {
    return {
      inLaunch: false,
      launchedAtIso: null,
      dayNum: 0,
      daysRemaining: 0,
      ordersSoFar: 0,
      categoryMedianAtWindow: null,
      targetOrders: partner.launch_target_orders ?? null,
      underSurveillance: false,
      windowEndIso: null,
      reviewNotes: partner.launch_review_notes ?? null,
    };
  }

  const launchedAt = new Date(partner.launched_at);
  const windowEnd = new Date(launchedAt.getTime() + LAUNCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msElapsed = now.getTime() - launchedAt.getTime();
  const dayNum = Math.min(
    LAUNCH_WINDOW_DAYS,
    Math.max(1, Math.floor(msElapsed / (1000 * 60 * 60 * 24)) + 1),
  );
  const daysRemaining = Math.max(0, LAUNCH_WINDOW_DAYS - dayNum + 1);
  const inLaunch = now < windowEnd;

  // Ordini attribuiti dal lancio ad adesso (o fino alla fine finestra)
  const windowStopIso = (inLaunch ? now : windowEnd).toISOString();
  const ordersRes = await admin
    .from("brand_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("partner_restaurant_id", partnerId)
    .in("status", ["completed", "pending"])
    .gte("placed_at", partner.launched_at)
    .lt("placed_at", windowStopIso);
  if (ordersRes.error) throw new Error(`launch orders: ${ordersRes.error.message}`);
  const ordersSoFar = (ordersRes.count ?? 0) as number;

  // Mediana categoria: ordini medi degli altri partner con stessa categoria
  // nei primi 30gg dal loro launched_at (chi e' gia' passato dalla fase).
  let categoryMedianAtWindow: number | null = null;
  if (partner.cuisine_category) {
    const { data: catPartners } = await admin
      .from("partner_restaurants")
      .select("id, launched_at")
      .eq("organization_id", organizationId)
      .eq("cuisine_category", partner.cuisine_category)
      .not("launched_at", "is", null)
      .neq("id", partnerId);
    const peers = ((catPartners ?? []) as { id: string; launched_at: string }[]).filter((p) => {
      // solo partner che hanno gia' completato (o quasi) la propria finestra
      const peerEnd = new Date(
        new Date(p.launched_at).getTime() + LAUNCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );
      return now > peerEnd;
    });
    if (peers.length >= 2) {
      const counts: number[] = [];
      for (const peer of peers) {
        const peerEnd = new Date(
          new Date(peer.launched_at).getTime() + LAUNCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        );
        const { count } = await admin
          .from("brand_orders")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("partner_restaurant_id", peer.id)
          .in("status", ["completed", "pending"])
          .gte("placed_at", peer.launched_at)
          .lt("placed_at", peerEnd.toISOString());
        counts.push(count ?? 0);
      }
      counts.sort((a, b) => a - b);
      const mid = Math.floor(counts.length / 2);
      categoryMedianAtWindow =
        counts.length % 2 === 0
          ? ((counts[mid - 1] ?? 0) + (counts[mid] ?? 0)) / 2
          : (counts[mid] ?? 0);
    }
  }

  // Determina soglia sorveglianza
  const effectiveTarget = partner.launch_target_orders ?? categoryMedianAtWindow ?? null;
  // Proiezione: a quale ritmo e' il partner? Se dayNum=10 e target=30 su 30gg,
  // pro-rata atteso = 10. ordersSoFar < 70% del pro-rata = sotto sorveglianza.
  let underSurveillance = false;
  if (effectiveTarget !== null && dayNum >= 7) {
    const proRata = (effectiveTarget * dayNum) / LAUNCH_WINDOW_DAYS;
    underSurveillance = ordersSoFar < proRata * 0.7;
  }

  return {
    inLaunch,
    launchedAtIso: partner.launched_at,
    dayNum,
    daysRemaining,
    ordersSoFar,
    categoryMedianAtWindow,
    targetOrders: partner.launch_target_orders ?? null,
    underSurveillance,
    windowEndIso: windowEnd.toISOString(),
    reviewNotes: partner.launch_review_notes ?? null,
  };
}

/**
 * Imposta launched_at = now() se non ancora valorizzato (idempotente).
 * Chiamato da upsertPartnerAction quando onboarding_status passa a 'attivo'
 * per la prima volta.
 */
export async function markPartnerLaunched(
  organizationId: string,
  partnerId: string,
  targetOrders?: number | null,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    launched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (targetOrders !== undefined && targetOrders !== null) {
    patch["launch_target_orders"] = targetOrders;
  }
  const { data, error } = await admin
    .from("partner_restaurants")
    .update(patch)
    .eq("id", partnerId)
    .eq("organization_id", organizationId)
    .is("launched_at", null) // idempotente: setta solo se non ancora lanciato
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`markPartnerLaunched: ${error.message}`);
  return data !== null;
}

/**
 * Aggiorna le note di review durante la fase di lancio.
 */
export async function updatePartnerLaunchNotes(
  organizationId: string,
  partnerId: string,
  notes: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("partner_restaurants")
    .update({
      launch_review_notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`updatePartnerLaunchNotes: ${error.message}`);
}
