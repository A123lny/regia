// M9 · rilevatore anti-abbandono.
// Genera signal quando i pattern sono rilevati. Idempotente via UNIQUE parziale
// (contact, kind) where resolved_at is null.

import { getAdminClient } from "@/lib/db/admin";
import type { AbandonmentKind, AbandonmentSeverity } from "./abandonment-types";

const DAY_MS = 24 * 60 * 60 * 1000;

async function upsertSignal(input: {
  organizationId: string;
  brandId: string;
  contactId: string;
  kind: AbandonmentKind;
  severity: AbandonmentSeverity;
  windowStartIso: string;
  windowEndIso: string;
  previousOrdersCount: number;
  currentOrdersCount: number;
  notes?: string;
}): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    contact_id: input.contactId,
    kind: input.kind,
    severity: input.severity,
    signal_at: new Date().toISOString(),
    window_start: input.windowStartIso,
    window_end: input.windowEndIso,
    previous_orders_count: input.previousOrdersCount,
    current_orders_count: input.currentOrdersCount,
    notes: input.notes ?? null,
  };
  const { error } = await admin.from("abandonment_signals").insert(row);
  if (error) {
    if (error.code === "23505") return false; // duplicato (già segnalato)
    throw new Error(`Errore insert signal: ${error.message}`);
  }
  return true;
}

/**
 * RN-40 · rilevatore "skipped week": contatto con >=4 ordini nelle 4 settimane
 * precedenti E 0 ordini nell'ultima settimana → skipped_week (severity high per Lenny).
 */
export async function detectSkippedWeek(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = Date.now();
  const oneWeekAgo = new Date(now - 7 * DAY_MS).toISOString();
  const fiveWeeksAgo = new Date(now - 35 * DAY_MS).toISOString();

  // Query: contatti con ordini nelle 4 settimane precedenti E 0 nell'ultima
  const { data: previousOrders, error: prevErr } = await admin
    .from("brand_orders")
    .select("contact_id, brand_id")
    .eq("organization_id", organizationId)
    .not("contact_id", "is", null)
    .gte("placed_at", fiveWeeksAgo)
    .lt("placed_at", oneWeekAgo);
  if (prevErr) throw new Error(`Prev orders: ${prevErr.message}`);

  const previousCountByContact = new Map<string, { count: number; brandId: string }>();
  for (const r of (previousOrders ?? []) as Array<{ contact_id: string; brand_id: string }>) {
    const prev = previousCountByContact.get(r.contact_id) ?? { count: 0, brandId: r.brand_id };
    prev.count++;
    previousCountByContact.set(r.contact_id, prev);
  }

  // Candidati: contatti con >=4 ordini nel periodo (4 settimane)
  const candidates: string[] = [];
  for (const [contactId, v] of previousCountByContact.entries()) {
    if (v.count >= 4) candidates.push(contactId);
  }
  if (candidates.length === 0) return { created: 0, skipped: 0 };

  const { data: recentOrders, error: recErr } = await admin
    .from("brand_orders")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .in("contact_id", candidates)
    .gte("placed_at", oneWeekAgo);
  if (recErr) throw new Error(`Recent orders: ${recErr.message}`);

  const recentIds = new Set(
    ((recentOrders ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id),
  );

  let created = 0;
  let skipped = 0;
  for (const contactId of candidates) {
    if (recentIds.has(contactId)) continue;
    const info = previousCountByContact.get(contactId)!;
    const ok = await upsertSignal({
      organizationId,
      brandId: info.brandId,
      contactId,
      kind: "skipped_week",
      severity: "high",
      windowStartIso: fiveWeeksAgo,
      windowEndIso: new Date(now).toISOString(),
      previousOrdersCount: info.count,
      currentOrdersCount: 0,
      notes: `Abituale (${info.count} ordini in 4 settimane) senza ordini nell'ultima settimana`,
    });
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

/**
 * silence_gap: 30+gg senza ordini per un contatto che aveva almeno 3 ordini nell'anno.
 * inactivity: 60+gg senza ordini per un contatto che aveva almeno 1 ordine nell'anno.
 */
export async function detectSilenceInactivity(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = Date.now();
  const oneYearAgoIso = new Date(now - 365 * DAY_MS).toISOString();
  const thirtyAgo = new Date(now - 30 * DAY_MS).toISOString();
  const sixtyAgo = new Date(now - 60 * DAY_MS).toISOString();

  const { data, error } = await admin
    .from("brand_orders")
    .select("contact_id, brand_id, placed_at")
    .eq("organization_id", organizationId)
    .not("contact_id", "is", null)
    .gte("placed_at", oneYearAgoIso);
  if (error) throw new Error(`Silence orders: ${error.message}`);

  // Aggregate per contatto: count + last_placed
  const agg = new Map<string, { count: number; lastPlaced: string; brandId: string }>();
  for (const r of (data ?? []) as Array<{
    contact_id: string;
    brand_id: string;
    placed_at: string;
  }>) {
    const prev = agg.get(r.contact_id);
    if (!prev) {
      agg.set(r.contact_id, { count: 1, lastPlaced: r.placed_at, brandId: r.brand_id });
    } else {
      prev.count++;
      if (r.placed_at > prev.lastPlaced) prev.lastPlaced = r.placed_at;
    }
  }

  let created = 0;
  let skipped = 0;
  for (const [contactId, v] of agg.entries()) {
    if (v.lastPlaced < sixtyAgo && v.count >= 1) {
      // inactivity
      const ok = await upsertSignal({
        organizationId,
        brandId: v.brandId,
        contactId,
        kind: "inactivity",
        severity: "high",
        windowStartIso: v.lastPlaced,
        windowEndIso: new Date(now).toISOString(),
        previousOrdersCount: v.count,
        currentOrdersCount: 0,
        notes: `60+ giorni senza ordini (ultimo: ${new Date(v.lastPlaced).toLocaleDateString("it-IT")})`,
      });
      if (ok) created++;
      else skipped++;
    } else if (v.lastPlaced < thirtyAgo && v.count >= 3) {
      const ok = await upsertSignal({
        organizationId,
        brandId: v.brandId,
        contactId,
        kind: "silence_gap",
        severity: "medium",
        windowStartIso: v.lastPlaced,
        windowEndIso: new Date(now).toISOString(),
        previousOrdersCount: v.count,
        currentOrdersCount: 0,
        notes: `30+ giorni senza ordini (${v.count} ordini nell'ultimo anno)`,
      });
      if (ok) created++;
      else skipped++;
    }
  }
  return { created, skipped };
}

/**
 * dropped_frequency: ordini negli ultimi 30gg <= 50% degli ordini dei 30gg precedenti.
 * Solo per contatti che avevano >=2 ordini nei 30gg precedenti (evita rumore su volumi bassi).
 */
export async function detectDroppedFrequency(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = Date.now();
  const thirtyAgo = new Date(now - 30 * DAY_MS).toISOString();
  const sixtyAgo = new Date(now - 60 * DAY_MS).toISOString();

  const [prevRes, currRes] = await Promise.all([
    admin
      .from("brand_orders")
      .select("contact_id, brand_id")
      .eq("organization_id", organizationId)
      .not("contact_id", "is", null)
      .gte("placed_at", sixtyAgo)
      .lt("placed_at", thirtyAgo),
    admin
      .from("brand_orders")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .not("contact_id", "is", null)
      .gte("placed_at", thirtyAgo),
  ]);
  if (prevRes.error) throw new Error(`Prev freq: ${prevRes.error.message}`);
  if (currRes.error) throw new Error(`Curr freq: ${currRes.error.message}`);

  const prevMap = new Map<string, { count: number; brandId: string }>();
  for (const r of (prevRes.data ?? []) as Array<{ contact_id: string; brand_id: string }>) {
    const prev = prevMap.get(r.contact_id) ?? { count: 0, brandId: r.brand_id };
    prev.count++;
    prevMap.set(r.contact_id, prev);
  }
  const currMap = new Map<string, number>();
  for (const r of (currRes.data ?? []) as Array<{ contact_id: string }>) {
    currMap.set(r.contact_id, (currMap.get(r.contact_id) ?? 0) + 1);
  }

  let created = 0;
  let skipped = 0;
  for (const [contactId, v] of prevMap.entries()) {
    if (v.count < 2) continue;
    const curr = currMap.get(contactId) ?? 0;
    if (curr >= v.count / 2) continue;
    const ok = await upsertSignal({
      organizationId,
      brandId: v.brandId,
      contactId,
      kind: "dropped_frequency",
      severity: "medium",
      windowStartIso: sixtyAgo,
      windowEndIso: new Date(now).toISOString(),
      previousOrdersCount: v.count,
      currentOrdersCount: curr,
      notes: `Frequenza dimezzata: ${v.count} → ${curr} ordini`,
    });
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

export async function detectAllAbandonmentSignals(organizationId: string): Promise<{
  skippedWeek: { created: number; skipped: number };
  droppedFrequency: { created: number; skipped: number };
  silenceInactivity: { created: number; skipped: number };
}> {
  const [skippedWeek, droppedFrequency, silenceInactivity] = await Promise.all([
    detectSkippedWeek(organizationId),
    detectDroppedFrequency(organizationId),
    detectSilenceInactivity(organizationId),
  ]);
  return { skippedWeek, droppedFrequency, silenceInactivity };
}
