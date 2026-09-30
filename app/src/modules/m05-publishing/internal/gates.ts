// M05 - i 6 gate obbligatori prima di enqueue (RA-8.6).
// Applicati in ordine, ogni fallimento è un throw tipizzato.

import { getAdminClient } from "@/lib/db/admin";
import {
  ConsentMissingError, ChannelDisabledError, PressureLimitError, BudgetExceededError,
  PromotionalNotAllowedError, RecipientMismatchError,
} from "./types";
import type { Channel } from "./types";
import { getChannelCredentials } from "./credentials-repo";
import { getChannelConfig } from "./channel-config-repo";

export type SourceKind = "test" | "reminder" | "voucher" | "campaign" | "signup_welcome" | "manual";

/**
 * Gate 1: consenso RF-1.4 per canale.
 *
 * Security: il bypass con contactId=null e' consentito SOLO per sourceKind='test'.
 * Ogni altro sourceKind (reminder/voucher/campaign/signup_welcome/manual) DEVE fornire
 * un contactId valido, altrimenti l'invio e' rifiutato (fail-closed).
 */
export async function gateConsent(organizationId: string, contactId: string | null, channel: Channel, sourceKind: SourceKind): Promise<void> {
  if (!contactId) {
    if (sourceKind === "test") return;  // ad-hoc test send permesso solo per test
    throw new ConsentMissingError(`Invio non-test senza contactId non permesso (sourceKind=${sourceKind})`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("contact_consents")
    .select("status").eq("organization_id", organizationId)
    .eq("contact_id", contactId).eq("channel", channel).maybeSingle();
  if (error) throw new Error(`gateConsent: ${error.message}`);
  if (!data || data.status !== "granted") {
    throw new ConsentMissingError(`Consenso ${channel} mancante o revocato per contatto ${contactId}`);
  }
}

/** Normalizzazione recipient: email lower+trim, telefono strip di caratteri non-cifra. */
function normalizeEmail(v: string): string { return v.trim().toLowerCase(); }
function normalizePhone(v: string): string { return v.replace(/[^0-9]/g, ""); }

/**
 * Security gate: verifica che payload.to combaci col recipient del contatto per il canale.
 * Previene consent laundering: attaccante passa contactId di Bob (consenziente) ma
 * payload.to punta a un indirizzo diverso.
 * Ritorna l'indirizzo canonico dal contatto (da usare come recipient_address del job).
 */
export async function gateRecipientMatchesContact(
  organizationId: string,
  contactId: string,
  channel: Channel,
  payloadTo: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("contacts")
    .select("email, phone_e164, whatsapp_e164")
    .eq("organization_id", organizationId).eq("id", contactId).maybeSingle();
  if (error) throw new Error(`gateRecipientMatchesContact: ${error.message}`);
  if (!data) throw new RecipientMismatchError(`Contatto ${contactId} non trovato in organization ${organizationId}`);
  let canonical: string | null = null;
  if (channel === "email") {
    canonical = data.email ? normalizeEmail(data.email as string) : null;
    if (!canonical || canonical !== normalizeEmail(payloadTo)) {
      throw new RecipientMismatchError(`payload.to non combacia con email del contatto ${contactId}`);
    }
    return data.email as string;
  }
  if (channel === "whatsapp") {
    const stored = (data.whatsapp_e164 ?? data.phone_e164) as string | null;
    canonical = stored ? normalizePhone(stored) : null;
    if (!canonical || canonical !== normalizePhone(payloadTo)) {
      throw new RecipientMismatchError(`payload.to non combacia con whatsapp/phone del contatto ${contactId}`);
    }
    return stored as string;
  }
  // Altri canali in v1 non sono ancora implementati per contact-based send.
  return payloadTo;
}

/** Gate 2: canale abilitato + verificato. */
export async function gateChannelEnabled(organizationId: string, channel: Channel): Promise<void> {
  const cred = await getChannelCredentials(organizationId, channel);
  if (!cred) throw new ChannelDisabledError(`Nessuna credenziale configurata per ${channel}`);
  if (!cred.enabled) throw new ChannelDisabledError(`Canale ${channel} disabilitato`);
  if (!cred.verifiedAt) throw new ChannelDisabledError(`Canale ${channel} non verificato (fai il test in Impostazioni)`);
}

/** Gate 3: quiet hours (RF-5.6). Ritorna il timestamp send_after applicato. */
export async function gateQuietHours(organizationId: string, channel: Channel): Promise<Date> {
  const config = await getChannelConfig(organizationId, channel);
  const now = new Date();
  if (channel !== "whatsapp") return now;  // quiet applica solo a WA in v1
  const [shRaw, smRaw] = config.quietHoursStart.split(":");
  const [ehRaw, emRaw] = config.quietHoursEnd.split(":");
  const sh = Number(shRaw ?? 0), sm = Number(smRaw ?? 0);
  const eh = Number(ehRaw ?? 0), em = Number(emRaw ?? 0);
  const hh = now.getHours();
  const mm = now.getMinutes();
  const cur = hh * 60 + mm;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const inQuietWindow = cur >= startMin && cur < endMin;
  if (inQuietWindow) return now;  // dentro fascia OK -> parte subito
  // fuori fascia -> ritarda a prossima quietHoursStart
  const target = new Date(now);
  target.setHours(sh, sm, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

/**
 * Gate 4: pressione commerciale (RA-8.4) + regola RF-5.5a "solo utilita" per WA.
 * Rifiuta l'invio promozionale quando allow_promotional=false sul canale (WA di default).
 * Applica il limite mensile solo se contactId presente e isPromotional=true.
 */
export async function gatePressureLimit(organizationId: string, contactId: string | null, channel: Channel, isPromotional: boolean): Promise<void> {
  if (!isPromotional) return;
  const config = await getChannelConfig(organizationId, channel);
  // RF-5.5a: se il canale non consente promo (default WA=false), rifiuta a prescindere dal limite.
  if (!config.allowPromotional) {
    throw new PromotionalNotAllowedError(`Canale ${channel} non consente contenuti promozionali (RF-5.5a)`);
  }
  if (!contactId) return;  // ad-hoc promo senza contactId non ha limite mensile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { count, error } = await admin.from("m05_publish_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("recipient_contact_id", contactId)
    .eq("channel", channel).eq("is_promotional", true).eq("status", "sent")
    .gte("sent_at", monthStart.toISOString());
  if (error) throw new Error(`gatePressureLimit: ${error.message}`);
  if ((count ?? 0) >= config.maxPerMonthPerContact) {
    throw new PressureLimitError(`Superato limite ${config.maxPerMonthPerContact}/mese per ${channel} su contatto ${contactId}`);
  }
}

/** Gate 5: governance content (RF-6.15..6.20). Chiamato solo se payload contiene offerta. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function gateGovernanceContent(_organizationId: string, _payload: unknown): Promise<void> {
  // In v1 non ci sono ancora hooks automatici: se il chiamante usa sendMessage per un voucher,
  // deve aver già chiamato m13-governance.validateOfferAgainstCommercialRules a monte.
  // TODO(v2): integrazione automatica sui payload con offer_id.
  return;
}

/** Gate 6: budget (RF-11.5 esteso). Skip in v1 se budget non configurato. */
export async function gateBudget(organizationId: string, channel: Channel, estimatedCostCents: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Recupera budget mensile per canale (se esiste). Riusa tabella ai_spend_budgets di M11
  // convertita a "publishing.<channel>" come service_name.
  const { data: budget } = await admin.from("ai_spend_budgets")
    .select("monthly_cap_cents").eq("organization_id", organizationId)
    .eq("service_name", `publishing.${channel}`).maybeSingle();
  if (!budget) return;  // budget non configurato -> gate skip
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data: spent } = await admin.from("m05_publish_log")
    .select("cost_actual_cents").eq("organization_id", organizationId)
    .eq("channel", channel).eq("status", "sent").gte("sent_at", monthStart.toISOString());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCents = ((spent ?? []) as any[]).reduce((sum, r) => sum + (r.cost_actual_cents ?? 0), 0);
  if (totalCents + estimatedCostCents > budget.monthly_cap_cents) {
    throw new BudgetExceededError(`Budget mensile ${channel} sforato (${totalCents}+${estimatedCostCents}>${budget.monthly_cap_cents} centesimi)`);
  }
}
