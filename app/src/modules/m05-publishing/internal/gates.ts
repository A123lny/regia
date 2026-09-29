// M05 - i 6 gate obbligatori prima di enqueue (RA-8.6).
// Applicati in ordine, ogni fallimento è un throw tipizzato.

import { getAdminClient } from "@/lib/db/admin";
import {
  ConsentMissingError, ChannelDisabledError, PressureLimitError, BudgetExceededError,
} from "./types";
import type { Channel } from "./types";
import { getChannelCredentials } from "./credentials-repo";
import { getChannelConfig } from "./channel-config-repo";

/** Gate 1: consenso RF-1.4 per canale. */
export async function gateConsent(organizationId: string, contactId: string | null, channel: Channel): Promise<void> {
  if (!contactId) return;  // test send senza contactId (destinatario ad-hoc) è permesso
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
  const [sh, sm] = config.quietHoursStart.split(":").map(Number);
  const [eh, em] = config.quietHoursEnd.split(":").map(Number);
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

/** Gate 4: pressione commerciale (RA-8.4) - solo per is_promotional=true. */
export async function gatePressureLimit(organizationId: string, contactId: string | null, channel: Channel, isPromotional: boolean): Promise<void> {
  if (!contactId || !isPromotional) return;
  const config = await getChannelConfig(organizationId, channel);
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
