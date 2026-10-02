// M05 Unsubscribe — RN-64..67.
// Token one-time, revoca immediata del consent (vincolo tecnico assoluto RN-64),
// motivo opzionale + "scrivetemi meno".

import { getAdminClient } from "@/lib/db/admin";
import { createHash } from "node:crypto";
import type { Channel } from "./types";

export type UnsubscribeReason =
  "too_many_messages" | "not_interested" | "not_customer_anymore" | "other";

export type ResolvedToken = {
  organizationId: string;
  contactId: string;
  channel: Channel;
  usedAt: string | null;
};

/**
 * Genera un token di disiscrizione per un invio.
 * Chiamato durante enqueueJob (dal M05 flusso), restituisce il token UUID da
 * inserire nel link del messaggio.
 */
export async function createUnsubscribeToken(input: {
  organizationId: string;
  contactId: string;
  channel: Channel;
  sourceKind?: string;
  sourceId?: string;
  publishJobId?: string;
}): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    contact_id: input.contactId,
    channel: input.channel,
  };
  if (input.sourceKind) row["source_kind"] = input.sourceKind;
  if (input.sourceId) row["source_id"] = input.sourceId;
  if (input.publishJobId) row["publish_job_id"] = input.publishJobId;
  const { data, error } = await admin
    .from("m05_unsubscribe_tokens")
    .insert(row)
    .select("token")
    .single();
  if (error) throw new Error(`createUnsubscribeToken: ${error.message}`);
  return (data as { token: string }).token;
}

export async function resolveUnsubscribeToken(token: string): Promise<ResolvedToken | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("m05_unsubscribe_tokens")
    .select("organization_id, contact_id, channel, used_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`resolveUnsubscribeToken: ${error.message}`);
  if (!data) return null;
  return {
    organizationId: data.organization_id as string,
    contactId: data.contact_id as string,
    channel: data.channel as Channel,
    usedAt: (data.used_at as string | null) ?? null,
  };
}

export type ApplyUnsubscribeInput = {
  token: string;
  reason?: UnsubscribeReason | null;
  reasonFree?: string | null;
  reduceFrequency?: boolean; // true = "scrivetemi meno" invece di revoca
  alsoChannels?: Channel[]; // altri canali su cui propagare la disiscrizione
  ipAddress?: string;
};

export type ApplyUnsubscribeResult =
  | { ok: true; channelsRevoked: Channel[]; channelsReduced: Channel[] }
  | { ok: false; error: string };

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Applica la disiscrizione. Il flusso e' idempotente: se il token e' gia' used_at,
 * ritorna comunque ok (il consenso potrebbe gia' essere revocato, ok).
 *
 * RN-64 vincolo assoluto: il click REVOCA IMMEDIATAMENTE. La chiamata a questa
 * funzione dalla landing avviene PRIMA di renderizzare il form. Il form puo' poi
 * aggiungere motivo + altri canali + reduce_frequency.
 */
export async function applyUnsubscribe(
  input: ApplyUnsubscribeInput,
): Promise<ApplyUnsubscribeResult> {
  const resolved = await resolveUnsubscribeToken(input.token);
  if (!resolved) return { ok: false, error: "Token non valido" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date().toISOString();

  const channelsRevoked: Channel[] = [];
  const channelsReduced: Channel[] = [];

  // Lista canali da trattare: quello del token + eventuali alsoChannels.
  const targetChannels = new Set<Channel>([resolved.channel, ...(input.alsoChannels ?? [])]);

  for (const ch of targetChannels) {
    const patch: Record<string, unknown> = {
      updated_at: now,
    };
    if (input.reduceFrequency) {
      // "Scrivetemi meno" (RN-66): segna frequency reduction, non revoca.
      patch["reduce_frequency"] = true;
      channelsReduced.push(ch);
    } else {
      patch["status"] = "revoked";
      patch["revoked_at"] = now;
      channelsRevoked.push(ch);
    }
    // Motivo + free text validi per TUTTI i canali trattati (una scelta per utente).
    if (input.reason !== undefined) patch["unsubscribe_reason"] = input.reason;
    if (input.reasonFree !== undefined) patch["unsubscribe_reason_free"] = input.reasonFree;

    const { error } = await admin
      .from("contact_consents")
      .update(patch)
      .eq("organization_id", resolved.organizationId)
      .eq("contact_id", resolved.contactId)
      .eq("channel", ch);
    if (error) {
      // Non blocchiamo: proseguiamo con gli altri canali. Il canale del token DEVE
      // comunque essere revocato (RN-64 vincolo assoluto): se fallisce, torniamo errore.
      if (ch === resolved.channel) {
        return { ok: false, error: `revoca canale ${ch}: ${error.message}` };
      }
      // Altri canali: log soft, continua.
      console.warn(`applyUnsubscribe: fallita propagazione a ${ch}: ${error.message}`);
    }
  }

  // Marca il token come used (se non lo era gia').
  const usedPatch: Record<string, unknown> = { used_at: now };
  if (input.ipAddress) usedPatch["used_from_ip_hash"] = hashIp(input.ipAddress);
  await admin
    .from("m05_unsubscribe_tokens")
    .update(usedPatch)
    .eq("token", input.token)
    .is("used_at", null);

  return { ok: true, channelsRevoked, channelsReduced };
}

/**
 * Revoca immediata su click (vincolo assoluto RN-64), SENZA motivo ne' altri canali.
 * Chiamato dalla landing PRIMA del render del form, cosi' il consent e' revocato
 * anche se l'utente chiude la pagina a meta'.
 */
export async function revokeConsentFromToken(
  token: string,
  ipAddress?: string,
): Promise<{ ok: true; channel: Channel; contactId: string } | { ok: false; error: string }> {
  const resolved = await resolveUnsubscribeToken(token);
  if (!resolved) return { ok: false, error: "Token non valido" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date().toISOString();

  // Revoca il consent del canale del token (idempotente: se gia' revoked, no-op effetto).
  const { error } = await admin
    .from("contact_consents")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("organization_id", resolved.organizationId)
    .eq("contact_id", resolved.contactId)
    .eq("channel", resolved.channel);
  if (error) return { ok: false, error: `revoca: ${error.message}` };

  // Marca il token used (prima volta).
  if (!resolved.usedAt) {
    const usedPatch: Record<string, unknown> = { used_at: now };
    if (ipAddress) usedPatch["used_from_ip_hash"] = hashIp(ipAddress);
    await admin
      .from("m05_unsubscribe_tokens")
      .update(usedPatch)
      .eq("token", token)
      .is("used_at", null);
  }

  return { ok: true, channel: resolved.channel, contactId: resolved.contactId };
}

export type PressureAlert = {
  organizationId: string;
  channel: Channel;
  revocations30d: number;
  tooMany30d: number;
  reduceFrequency30d: number;
  tooManyRatio: number; // 0..1
  isAlert: boolean; // ratio >= 0.5
};

/**
 * RN-67: aggrega disiscrizioni ultimi 30gg. Se >= 50% ha motivo "troppi messaggi",
 * il canale e' in allarme (pressione commerciale troppo alta).
 */
export async function getUnsubscribePressureAlerts(
  organizationId: string,
): Promise<PressureAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("m05_unsubscribe_pressure_alerts")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw new Error(`getUnsubscribePressureAlerts: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => {
    const revocations = Number(r.revocations_30d ?? 0);
    const tooMany = Number(r.too_many_30d ?? 0);
    const ratio = revocations > 0 ? tooMany / revocations : 0;
    return {
      organizationId: r.organization_id as string,
      channel: r.channel as Channel,
      revocations30d: revocations,
      tooMany30d: tooMany,
      reduceFrequency30d: Number(r.reduce_frequency_30d ?? 0),
      tooManyRatio: ratio,
      isAlert: ratio >= 0.5 && revocations >= 3, // soglia: 50% + minimo 3 revoche assolute
    };
  });
}
