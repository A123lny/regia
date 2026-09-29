// M09 — compute engine: scan periodici + trigger event-driven.
// Ogni funzione è idempotente: chiamarla 2 volte non crea duplicati (UNIQUE parziale DB).

import { getAdminClient } from "@/lib/db/admin";
import { scheduleReminder } from "./reminders-repo";

const DAYS_MS = 24 * 60 * 60 * 1000;

/**
 * RF-6.22 richiamo officina data certa (tagliando classico a 12 mesi).
 * Scan veicoli con last_service_at + 12 mesi entro 30 giorni.
 * Contatto deve appartenere al brand "officina" o "stazione".
 */
export async function refreshServiceCallReminders(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const nowIso = new Date().toISOString();
  const in30dIso = new Date(Date.now() + 30 * DAYS_MS).toISOString();

  // Veicoli con last_service_at tra 11 e 12 mesi fa (tagliando dovuto entro 30gg)
  const cutoffFuture = new Date();
  cutoffFuture.setMonth(cutoffFuture.getMonth() - 11);
  const cutoffFutureIso = cutoffFuture.toISOString().slice(0, 10);
  const cutoffPast = new Date();
  cutoffPast.setMonth(cutoffPast.getMonth() - 13);
  const cutoffPastIso = cutoffPast.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("contact_vehicles")
    .select("id, contact_id, plate, last_service_at, contacts!inner(brand_id, archived_at)")
    .eq("organization_id", organizationId)
    .not("last_service_at", "is", null)
    .gte("last_service_at", cutoffPastIso)
    .lte("last_service_at", cutoffFutureIso)
    .is("contacts.archived_at", null);
  if (error) throw new Error(`Scan service_call: ${error.message}`);

  let created = 0;
  let skipped = 0;
  for (const v of (data ?? []) as Array<{
    id: string;
    contact_id: string;
    plate: string;
    last_service_at: string;
    contacts: { brand_id: string };
  }>) {
    // Scheduled = 12 mesi da last_service_at (min = now se già passato)
    const scheduledDate = new Date(v.last_service_at);
    scheduledDate.setMonth(scheduledDate.getMonth() + 12);
    const scheduledIso =
      scheduledDate.toISOString() < nowIso ? nowIso : scheduledDate.toISOString();
    if (scheduledIso > in30dIso) {
      skipped++;
      continue;
    }
    const ok = await scheduleReminder({
      organizationId,
      brandId: v.contacts.brand_id,
      contactId: v.contact_id,
      kind: "service_call",
      referenceType: "vehicle",
      referenceId: v.id,
      scheduledAtIso: scheduledIso,
      messageHint: `Richiamo tagliando per veicolo ${v.plate} — ultimo intervento ${v.last_service_at}`,
    });
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

/**
 * RF-6.22 voucher in scadenza: promemoria a 10gg dalla scadenza.
 */
export async function refreshVoucherExpiringReminders(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const nowIso = new Date().toISOString();
  const in10dIso = new Date(Date.now() + 10 * DAYS_MS).toISOString();

  const { data, error } = await admin
    .from("vouchers")
    .select("id, contact_id, code, expires_at, voucher_offers!inner(issuer_brand_id)")
    .eq("organization_id", organizationId)
    .eq("status", "issued")
    .gt("expires_at", nowIso)
    .lte("expires_at", in10dIso);
  if (error) throw new Error(`Scan voucher_expiring: ${error.message}`);

  let created = 0;
  let skipped = 0;
  for (const v of (data ?? []) as Array<{
    id: string;
    contact_id: string;
    code: string;
    expires_at: string;
    voucher_offers: { issuer_brand_id: string };
  }>) {
    // Reminder scheduled per "adesso" (già entro 10gg dalla scadenza)
    const ok = await scheduleReminder({
      organizationId,
      brandId: v.voucher_offers.issuer_brand_id,
      contactId: v.contact_id,
      kind: "voucher_expiring",
      referenceType: "voucher",
      referenceId: v.id,
      scheduledAtIso: nowIso,
      messageHint: `Voucher ${v.code} scade il ${new Date(v.expires_at).toLocaleDateString("it-IT")}`,
    });
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

/**
 * RF-6.22 dormienti: contatti attivi senza ordini negli ultimi 60gg.
 * Solo contatti con almeno un consenso granted (non ha senso senza canale).
 */
export async function refreshDormantReminders(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const cutoff = new Date(Date.now() - 60 * DAYS_MS).toISOString();
  const nowIso = new Date().toISOString();

  // Contatti attivi con consenso email/sms/whatsapp granted
  const { data: consented, error: cErr } = await admin
    .from("contact_consents")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("status", "granted");
  if (cErr) throw new Error(`Consensi: ${cErr.message}`);
  const consentedIds = Array.from(
    new Set(((consented ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id)),
  );
  if (consentedIds.length === 0) return { created: 0, skipped: 0 };

  // Ordini recenti per escludere
  const { data: recent, error: rErr } = await admin
    .from("brand_orders")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .not("contact_id", "is", null)
    .gte("placed_at", cutoff);
  if (rErr) throw new Error(`Ordini recenti: ${rErr.message}`);
  const recentIds = new Set(
    ((recent ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id),
  );

  // Candidati = consented AND NOT recent
  const candidates = consentedIds.filter((id) => !recentIds.has(id));
  if (candidates.length === 0) return { created: 0, skipped: 0 };

  const { data: contacts, error: coErr } = await admin
    .from("contacts")
    .select("id, brand_id")
    .in("id", candidates)
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (coErr) throw new Error(`Contacts: ${coErr.message}`);

  let created = 0;
  let skipped = 0;
  for (const c of (contacts ?? []) as Array<{ id: string; brand_id: string }>) {
    const ok = await scheduleReminder({
      organizationId,
      brandId: c.brand_id,
      contactId: c.id,
      kind: "dormant_reactivation",
      scheduledAtIso: nowIso,
      messageHint: `Cliente inattivo da oltre 60 giorni — valuta riattivazione`,
    });
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

/**
 * RF-6.22 contatore vicino alla soglia: >=80% del threshold.
 */
export async function refreshCounterCloseReminders(
  organizationId: string,
): Promise<{ created: number; skipped: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const nowIso = new Date().toISOString();

  const { data: counters, error: cErr } = await admin
    .from("loyalty_counters")
    .select("id, brand_id, name, kind, threshold_count, threshold_value_cents")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (cErr) throw new Error(`Counters: ${cErr.message}`);
  const countersList = (counters ?? []) as Array<{
    id: string;
    brand_id: string;
    name: string;
    kind: string;
    threshold_count: number | null;
    threshold_value_cents: number | null;
  }>;
  if (countersList.length === 0) return { created: 0, skipped: 0 };

  const { data: events, error: eErr } = await admin
    .from("loyalty_counter_events")
    .select("counter_id, contact_id, delta_count, delta_value_cents")
    .eq("organization_id", organizationId);
  if (eErr) throw new Error(`Events: ${eErr.message}`);

  // Aggrega per (counter, contact)
  const progressMap = new Map<string, { count: number; valueCents: number }>();
  for (const e of (events ?? []) as Array<{
    counter_id: string;
    contact_id: string;
    delta_count: number;
    delta_value_cents: number;
  }>) {
    const key = `${e.counter_id}|${e.contact_id}`;
    const prev = progressMap.get(key) ?? { count: 0, valueCents: 0 };
    prev.count += Number(e.delta_count ?? 0);
    prev.valueCents += Number(e.delta_value_cents ?? 0);
    progressMap.set(key, prev);
  }

  let created = 0;
  let skipped = 0;
  for (const [key, agg] of progressMap.entries()) {
    const [counterId, contactId] = key.split("|");
    if (!counterId || !contactId) continue;
    const counter = countersList.find((c) => c.id === counterId);
    if (!counter) continue;
    const threshold =
      counter.kind === "valore_speso"
        ? (counter.threshold_value_cents ?? 1)
        : (counter.threshold_count ?? 1);
    const progress = counter.kind === "valore_speso" ? agg.valueCents : agg.count;
    const pct = threshold > 0 ? (progress / threshold) * 100 : 0;
    if (pct < 80 || pct >= 100) continue;

    const ok = await scheduleReminder({
      organizationId,
      brandId: counter.brand_id,
      contactId,
      kind: "counter_close",
      referenceType: "counter",
      referenceId: counterId,
      scheduledAtIso: nowIso,
      messageHint: `A ${Math.round(pct)}% della soglia "${counter.name}" (${progress}/${threshold})`,
    });
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

/**
 * Event-driven: chiamato da M10 quando un nuovo signup avviene.
 * Schedula welcome fra 1 ora (buffer per non essere invasivi immediatamente).
 */
export async function scheduleWelcomeReminder(input: {
  organizationId: string;
  brandId: string;
  contactId: string;
}): Promise<void> {
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await scheduleReminder({
    organizationId: input.organizationId,
    brandId: input.brandId,
    contactId: input.contactId,
    kind: "welcome",
    referenceType: "signup",
    scheduledAtIso: scheduledAt,
    messageHint: "Benvenuto dopo iscrizione landing",
  });
}

/**
 * Orchestratore che chiama tutte le refresh functions.
 * Ritorna sommario per la UI.
 */
export async function refreshAllReminders(organizationId: string): Promise<{
  serviceCall: { created: number; skipped: number };
  voucherExpiring: { created: number; skipped: number };
  dormant: { created: number; skipped: number };
  counterClose: { created: number; skipped: number };
}> {
  const [serviceCall, voucherExpiring, dormant, counterClose] = await Promise.all([
    refreshServiceCallReminders(organizationId),
    refreshVoucherExpiringReminders(organizationId),
    refreshDormantReminders(organizationId),
    refreshCounterCloseReminders(organizationId),
  ]);
  return { serviceCall, voucherExpiring, dormant, counterClose };
}
