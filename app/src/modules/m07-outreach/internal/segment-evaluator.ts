// M07 — valutatore criteri segmento.
// Ritorna gli ID dei contatti che matchano i criteri per (organization, brand).
// Query dinamica su contacts + join opzionali su consents/orders.
// Volumi F1 piccoli (<10k contatti): niente materializzazione fine, ricalcolo on-demand.

import { getAdminClient } from "@/lib/db/admin";
import type { SegmentCriteria } from "./outreach-types";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Conta contatti matching. Non ritorna gli ID per non sprecare payload (in F1 basta il count).
 * Se serviranno gli ID per l'invio effettivo, si aggiunge `listMatchingContactIds` in M5.
 */
export async function countMatchingContacts(
  organizationId: string,
  brandId: string,
  criteria: SegmentCriteria,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Step 1: prefiltro contact_id da consensi se richiesto
  let consentContactIds: string[] | null = null;
  if (criteria.requiredConsentChannel) {
    const { data, error } = await admin
      .from("contact_consents")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .eq("channel", criteria.requiredConsentChannel)
      .eq("status", "granted");
    if (error) throw new Error(`Errore filtro consensi: ${error.message}`);
    consentContactIds = ((data ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id);
    if (consentContactIds.length === 0) return 0;
  }

  // Step 2: prefiltro contact_id da ordini se recency/frequency/value richiesti
  let orderContactIds: string[] | null = null;
  const needsOrders =
    criteria.lastOrderMaxDays !== undefined ||
    criteria.minOrderCount !== undefined ||
    criteria.minSpentCents !== undefined;
  const needsSilence = criteria.lastOrderMinDays !== undefined;

  if (needsOrders) {
    // Contatti con almeno un ordine che soddisfa i vincoli aggregati
    const q = admin
      .from("brand_orders")
      .select("contact_id, total_cents, placed_at")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .in("status", ["completed", "refunded"])
      .not("contact_id", "is", null);

    if (criteria.lastOrderMaxDays !== undefined) {
      q.gte("placed_at", daysAgoIso(criteria.lastOrderMaxDays));
    }

    const { data, error } = await q;
    if (error) throw new Error(`Errore filtro ordini: ${error.message}`);
    const rows = (data ?? []) as Array<{
      contact_id: string;
      total_cents: number;
      placed_at: string;
    }>;

    // Aggrego per contact_id
    const agg = new Map<string, { count: number; totalCents: number }>();
    for (const r of rows) {
      const prev = agg.get(r.contact_id) ?? { count: 0, totalCents: 0 };
      prev.count++;
      prev.totalCents += Number(r.total_cents ?? 0);
      agg.set(r.contact_id, prev);
    }

    const passed: string[] = [];
    for (const [cid, v] of agg.entries()) {
      if (criteria.minOrderCount !== undefined && v.count < criteria.minOrderCount) continue;
      if (criteria.minSpentCents !== undefined && v.totalCents < criteria.minSpentCents) continue;
      passed.push(cid);
    }
    orderContactIds = passed;
    if (orderContactIds.length === 0) return 0;
  }

  // Step 3: se richiedo silenzio (dormienti), estraggo i contact_id CHE HANNO ordini recenti
  // e li escluderò
  let recentOrdererIds: string[] | null = null;
  if (needsSilence && criteria.lastOrderMinDays !== undefined) {
    const { data, error } = await admin
      .from("brand_orders")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .in("status", ["completed", "refunded", "pending"])
      .gte("placed_at", daysAgoIso(criteria.lastOrderMinDays))
      .not("contact_id", "is", null);
    if (error) throw new Error(`Errore filtro silenzio: ${error.message}`);
    recentOrdererIds = Array.from(
      new Set(((data ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id)),
    );
  }

  // Step 4: query finale sui contatti
  let cq = admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .is("archived_at", null);

  if (consentContactIds) cq = cq.in("id", consentContactIds);
  if (orderContactIds) cq = cq.in("id", orderContactIds);
  if (recentOrdererIds && recentOrdererIds.length > 0) {
    // Escludo chi ha ordini recenti (silenzio)
    // Postgrest supporta `not.in` con lista di valori
    cq = cq.not("id", "in", `(${recentOrdererIds.map((v) => `"${v}"`).join(",")})`);
  }

  // Tag filtering: postgrest .contains su array
  if (criteria.requiredTags && criteria.requiredTags.length > 0) {
    cq = cq.contains("tags", criteria.requiredTags);
  }
  if (criteria.excludeTags && criteria.excludeTags.length > 0) {
    // Overlap negato: nessun tag deve overlappare
    cq = cq.not("tags", "ov", `{${criteria.excludeTags.map((t) => `"${t}"`).join(",")}}`);
  }

  const { count, error } = await cq;
  if (error) throw new Error(`Errore count segmento: ${error.message}`);
  return count ?? 0;
}

/**
 * Ritorna gli ID dei contatti che matchano i criteri (per invio reale M07→M05).
 * Semantica identica a countMatchingContacts ma restituisce la lista.
 */
export async function listMatchingContactIds(
  organizationId: string,
  brandId: string,
  criteria: SegmentCriteria,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  let consentContactIds: string[] | null = null;
  if (criteria.requiredConsentChannel) {
    const { data, error } = await admin
      .from("contact_consents")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .eq("channel", criteria.requiredConsentChannel)
      .eq("status", "granted");
    if (error) throw new Error(`Errore filtro consensi: ${error.message}`);
    consentContactIds = ((data ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id);
    if (consentContactIds.length === 0) return [];
  }

  let orderContactIds: string[] | null = null;
  const needsOrders =
    criteria.lastOrderMaxDays !== undefined ||
    criteria.minOrderCount !== undefined ||
    criteria.minSpentCents !== undefined;
  const needsSilence = criteria.lastOrderMinDays !== undefined;

  if (needsOrders) {
    const q = admin
      .from("brand_orders")
      .select("contact_id, total_cents, placed_at")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .in("status", ["completed", "refunded"])
      .not("contact_id", "is", null);
    if (criteria.lastOrderMaxDays !== undefined) {
      q.gte("placed_at", daysAgoIso(criteria.lastOrderMaxDays));
    }
    const { data, error } = await q;
    if (error) throw new Error(`Errore filtro ordini: ${error.message}`);
    const rows = (data ?? []) as Array<{
      contact_id: string;
      total_cents: number;
      placed_at: string;
    }>;
    const agg = new Map<string, { count: number; totalCents: number }>();
    for (const r of rows) {
      const prev = agg.get(r.contact_id) ?? { count: 0, totalCents: 0 };
      prev.count++;
      prev.totalCents += Number(r.total_cents ?? 0);
      agg.set(r.contact_id, prev);
    }
    const passed: string[] = [];
    for (const [cid, v] of agg.entries()) {
      if (criteria.minOrderCount !== undefined && v.count < criteria.minOrderCount) continue;
      if (criteria.minSpentCents !== undefined && v.totalCents < criteria.minSpentCents) continue;
      passed.push(cid);
    }
    orderContactIds = passed;
    if (orderContactIds.length === 0) return [];
  }

  let recentOrdererIds: string[] | null = null;
  if (needsSilence && criteria.lastOrderMinDays !== undefined) {
    const { data, error } = await admin
      .from("brand_orders")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .in("status", ["completed", "refunded", "pending"])
      .gte("placed_at", daysAgoIso(criteria.lastOrderMinDays))
      .not("contact_id", "is", null);
    if (error) throw new Error(`Errore filtro silenzio: ${error.message}`);
    recentOrdererIds = Array.from(
      new Set(((data ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id)),
    );
  }

  let cq = admin
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .is("archived_at", null);
  if (consentContactIds) cq = cq.in("id", consentContactIds);
  if (orderContactIds) cq = cq.in("id", orderContactIds);
  if (recentOrdererIds && recentOrdererIds.length > 0) {
    cq = cq.not("id", "in", `(${recentOrdererIds.map((v) => `"${v}"`).join(",")})`);
  }
  if (criteria.requiredTags && criteria.requiredTags.length > 0) {
    cq = cq.contains("tags", criteria.requiredTags);
  }
  if (criteria.excludeTags && criteria.excludeTags.length > 0) {
    cq = cq.not("tags", "ov", `{${criteria.excludeTags.map((t) => `"${t}"`).join(",")}}`);
  }
  const { data, error } = await cq.order("id");
  if (error) throw new Error(`Errore list segment contacts: ${error.message}`);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}
