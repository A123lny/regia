// RF-1.7 · merge di due contatti duplicati.
// Il "survivor" resta attivo; il "duplicate" viene marcato archiviato +
// is_duplicate_of = survivor.id. Tutte le FK vengono migrate.
// Consensi: priorità granted > revoked > never per (contact, channel).

import { getAdminClient } from "@/lib/db/admin";

export type MergeResult = {
  survivorId: string;
  duplicateId: string;
  migratedOrders: number;
  migratedVouchers: number;
  migratedVehicles: number;
  migratedCounterEvents: number;
  migratedSignupEvents: number;
  migratedReminders: number;
  consentsUpdated: number;
};

const CONSENT_PRIORITY: Record<string, number> = {
  granted: 3,
  revoked: 2,
  never: 1,
};

/**
 * Merge distruttivo: sposta tutti i dati dal `duplicateId` al `survivorId`
 * e archivia il duplicato con is_duplicate_of=survivorId.
 *
 * NON è transazionale (Supabase JS non supporta transazioni multi-statement).
 * L'ordine è studiato per essere resistente a fallimenti parziali:
 *   1. Migra consensi (con logica di priorità)
 *   2. Migra FK "spostabili" (voucher, ordini, veicoli, counter events, signup events, reminders)
 *   3. Marca duplicato archiviato + is_duplicate_of
 *
 * Se falliamo tra 1 e 3: il duplicato resta attivo, ma i dati sono già migrati.
 * Ripetere l'operazione è idempotente (i dati già migrati non hanno effetto).
 */
export async function mergeContacts(
  survivorId: string,
  duplicateId: string,
  organizationId: string,
): Promise<MergeResult> {
  if (survivorId === duplicateId) {
    throw new Error("Survivor e duplicate devono essere contatti diversi");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Verifica ownership entrambi
  const { data: check, error: cErr } = await admin
    .from("contacts")
    .select("id, organization_id, archived_at, is_duplicate_of")
    .in("id", [survivorId, duplicateId]);
  if (cErr) throw new Error(`Verifica contatti: ${cErr.message}`);
  const list = (check ?? []) as Array<{
    id: string;
    organization_id: string;
    archived_at: string | null;
    is_duplicate_of: string | null;
  }>;
  if (list.length !== 2) throw new Error("Uno dei contatti non esiste");
  for (const c of list) {
    if (c.organization_id !== organizationId) {
      throw new Error("Contatti di organization diverse — merge negato");
    }
    if (c.archived_at) throw new Error("Uno dei contatti è già archiviato");
  }

  // 1. Consensi: merge con priorità granted > revoked > never
  const { data: consents, error: coErr } = await admin
    .from("contact_consents")
    .select("id, contact_id, channel, status, granted_at, revoked_at, source, evidence_text")
    .in("contact_id", [survivorId, duplicateId]);
  if (coErr) throw new Error(`Consensi: ${coErr.message}`);

  const bySurvivor = new Map<
    string,
    {
      id: string;
      status: string;
      granted_at: string | null;
      revoked_at: string | null;
      source: string;
      evidence_text: string | null;
    }
  >();
  const byDuplicate = new Map<
    string,
    {
      id: string;
      status: string;
      granted_at: string | null;
      revoked_at: string | null;
      source: string;
      evidence_text: string | null;
    }
  >();
  for (const c of (consents ?? []) as Array<{
    id: string;
    contact_id: string;
    channel: string;
    status: string;
    granted_at: string | null;
    revoked_at: string | null;
    source: string;
    evidence_text: string | null;
  }>) {
    const map = c.contact_id === survivorId ? bySurvivor : byDuplicate;
    map.set(c.channel, {
      id: c.id,
      status: c.status,
      granted_at: c.granted_at,
      revoked_at: c.revoked_at,
      source: c.source,
      evidence_text: c.evidence_text,
    });
  }

  let consentsUpdated = 0;
  const allChannels = ["email", "sms", "whatsapp"];
  for (const channel of allChannels) {
    const s = bySurvivor.get(channel);
    const d = byDuplicate.get(channel);
    if (!d) continue; // duplicate non ha consenso su questo canale, niente da fare
    if (!s) {
      // Survivor non ha consenso: sposta il duplicate su survivor
      const { error: mErr } = await admin
        .from("contact_consents")
        .update({ contact_id: survivorId })
        .eq("id", d.id);
      if (mErr) throw new Error(`Migrate consent ${channel}: ${mErr.message}`);
      consentsUpdated++;
    } else {
      // Entrambi hanno consenso: tieni quello con priorità più alta
      const sPri = CONSENT_PRIORITY[s.status] ?? 0;
      const dPri = CONSENT_PRIORITY[d.status] ?? 0;
      if (dPri > sPri) {
        // Duplicate ha priorità: sostituisci il record del survivor
        await admin
          .from("contact_consents")
          .update({
            status: d.status,
            granted_at: d.granted_at,
            revoked_at: d.revoked_at,
            source: d.source,
            evidence_text: d.evidence_text ?? "Migrato da merge duplicati",
          })
          .eq("id", s.id);
        consentsUpdated++;
      }
      // Poi elimino il record del duplicate (UNIQUE contact_id+channel non permette di lasciarlo)
      await admin.from("contact_consents").delete().eq("id", d.id);
    }
  }

  // 2. FK "spostabili" (ordini, voucher, veicoli, counter_events, signup_events, reminders)
  const [ordersU, vouchersU, vehiclesU, counterU, signupU, remindersU] = await Promise.all([
    admin
      .from("brand_orders")
      .update({ contact_id: survivorId })
      .eq("contact_id", duplicateId)
      .select("id"),
    admin
      .from("vouchers")
      .update({ contact_id: survivorId })
      .eq("contact_id", duplicateId)
      .select("id"),
    admin
      .from("contact_vehicles")
      .update({ contact_id: survivorId })
      .eq("contact_id", duplicateId)
      .select("id"),
    admin
      .from("loyalty_counter_events")
      .update({ contact_id: survivorId })
      .eq("contact_id", duplicateId)
      .select("id"),
    admin
      .from("signup_events")
      .update({ contact_id: survivorId })
      .eq("contact_id", duplicateId)
      .select("id"),
    admin
      .from("reminders")
      .update({ contact_id: survivorId })
      .eq("contact_id", duplicateId)
      .select("id"),
  ]);

  for (const [name, res] of Object.entries({
    orders: ordersU,
    vouchers: vouchersU,
    vehicles: vehiclesU,
    counter: counterU,
    signup: signupU,
    reminders: remindersU,
  })) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = res as any;
    if (r.error) throw new Error(`Migrate ${name}: ${r.error.message}`);
  }

  // 3. Marca duplicato come archiviato + link al survivor
  const { error: aErr } = await admin
    .from("contacts")
    .update({
      is_duplicate_of: survivorId,
      archived_at: new Date().toISOString(),
    })
    .eq("id", duplicateId)
    .eq("organization_id", organizationId);
  if (aErr) throw new Error(`Archive duplicate: ${aErr.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asAny = (v: any) => v as { data: unknown[] | null };

  return {
    survivorId,
    duplicateId,
    migratedOrders: (asAny(ordersU).data ?? []).length,
    migratedVouchers: (asAny(vouchersU).data ?? []).length,
    migratedVehicles: (asAny(vehiclesU).data ?? []).length,
    migratedCounterEvents: (asAny(counterU).data ?? []).length,
    migratedSignupEvents: (asAny(signupU).data ?? []).length,
    migratedReminders: (asAny(remindersU).data ?? []).length,
    consentsUpdated,
  };
}
