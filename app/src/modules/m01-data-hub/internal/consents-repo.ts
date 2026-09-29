// M01 Data Hub — repo consensi per canale (RF-1.4).
// Il blocco a monte dell'invio è nel motore comunicazione (M5, futuro): qui il repo
// espone lo stato e le mutazioni con audit. UNIQUE (contact_id, channel) garantita in DB.

import { getAdminClient } from "@/lib/db/admin";
import type {
  ContactConsent,
  ConsentChannel,
  ConsentSource,
  ConsentStatus,
} from "./contacts-types";

const SELECT_COLS =
  "id, organization_id, contact_id, channel, status, granted_at, revoked_at, source, evidence_text, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToConsent(row: any): ContactConsent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    channel: row.channel as ConsentChannel,
    status: row.status as ConsentStatus,
    grantedAt: row.granted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    source: row.source as ConsentSource,
    evidenceText: row.evidence_text ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Ritorna 3 consensi (uno per canale) per un contatto. Se un canale non ha mai
 * avuto un record, viene sintetizzato uno stato 'never' senza persist (visualizzazione).
 */
export async function listConsentsByContact(
  contactId: string,
  organizationId: string,
): Promise<ContactConsent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contact_consents")
    .select(SELECT_COLS)
    .eq("contact_id", contactId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`Errore lettura consensi: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = ((data ?? []) as any[]).map(rowToConsent);
  const byChannel = new Map(stored.map((c) => [c.channel, c]));

  // Sintetizza 'never' per canali senza record (non persist).
  const allChannels: ConsentChannel[] = ["email", "sms", "whatsapp"];
  return allChannels.map((ch) => {
    const existing = byChannel.get(ch);
    if (existing) return existing;
    return {
      id: `virtual-${contactId}-${ch}`,
      organizationId,
      contactId,
      channel: ch,
      status: "never" as ConsentStatus,
      grantedAt: null,
      revokedAt: null,
      source: "manuale" as ConsentSource,
      evidenceText: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  });
}

export type UpsertConsentInput = {
  organizationId: string;
  contactId: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  source: ConsentSource;
  evidenceText?: string | null;
};

/**
 * Upsert consenso per (contact, channel). Applica coerenza timestamp:
 *   granted → set granted_at=now, revoked_at=null
 *   revoked → set revoked_at=now, granted_at preservato (se assente set now come ripiego)
 *   never   → set granted_at=null, revoked_at=null
 * Garantisce il check constraint DB `consent_status_timestamps_coherent`.
 */
export async function upsertConsent(input: UpsertConsentInput): Promise<ContactConsent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("contact_consents")
    .select(SELECT_COLS)
    .eq("contact_id", input.contactId)
    .eq("organization_id", input.organizationId)
    .eq("channel", input.channel)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    organization_id: input.organizationId,
    contact_id: input.contactId,
    channel: input.channel,
    status: input.status,
    source: input.source,
    evidence_text: input.evidenceText ?? null,
  };
  if (input.status === "granted") {
    patch["granted_at"] = now;
    patch["revoked_at"] = null;
  } else if (input.status === "revoked") {
    // Se non c'era mai stato un granted_at, mettiamo `now` come minimo per rispettare
    // il check constraint (granted_at not null quando revoked). Interpretazione:
    // "iscritto e disiscritto in blocco" (caso import legacy o disiscrizione preventiva).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch["granted_at"] = (existing as any)?.granted_at ?? now;
    patch["revoked_at"] = now;
  } else {
    // never
    patch["granted_at"] = null;
    patch["revoked_at"] = null;
  }

  if (existing) {
    const { data, error } = await admin
      .from("contact_consents")
      .update(patch)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq("id", (existing as any).id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore aggiornamento consenso: ${error.message}`);
    return rowToConsent(data);
  } else {
    const { data, error } = await admin
      .from("contact_consents")
      .insert(patch)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore inserimento consenso: ${error.message}`);
    return rowToConsent(data);
  }
}
