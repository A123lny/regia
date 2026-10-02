// M09 → M05 bridge: invia un reminder via publish adapter.
// Mapping deterministico kind -> canale + flag promotional + payload template.

import { getAdminClient } from "@/lib/db/admin";
import { sendMessage, type OutgoingMessage, type Channel } from "@/modules/m05-publishing/public";
import type { ReminderKind, Reminder } from "./reminders-types";
import { getReminder } from "./reminders-repo";

type ChannelConfig = {
  channel: Channel;
  isPromotional: boolean;
};

// RF-5.5a: WA solo per utilita (voucher/richiami/avvisi/benvenuto).
// dormant_reactivation e' promozionale per natura -> email obbligata.
const KIND_CHANNEL_MAP: Record<ReminderKind, ChannelConfig> = {
  welcome: { channel: "whatsapp", isPromotional: false },
  thanks_order: { channel: "whatsapp", isPromotional: false },
  service_call: { channel: "whatsapp", isPromotional: false },
  voucher_expiring: { channel: "whatsapp", isPromotional: false },
  counter_close: { channel: "whatsapp", isPromotional: false },
  dormant_reactivation: { channel: "email", isPromotional: true },
  review_request: { channel: "email", isPromotional: false },
};

export function getChannelForReminderKind(kind: ReminderKind): ChannelConfig {
  return KIND_CHANNEL_MAP[kind];
}

type ContactInfo = {
  firstName: string | null;
  email: string | null;
  phoneE164: string | null;
  whatsappE164: string | null;
};

async function loadContact(organizationId: string, contactId: string): Promise<ContactInfo | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contacts")
    .select("first_name, email, phone, whatsapp")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(`loadContact: ${error.message}`);
  if (!data) return null;
  return {
    firstName: data.first_name ?? null,
    email: data.email ?? null,
    phoneE164: data.phone ?? null,
    whatsappE164: data.whatsapp ?? null,
  };
}

async function loadBrandIdentity(
  organizationId: string,
  brandId: string,
): Promise<{ fromEmail: string | null; replyTo: string | null; displayName: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin
    .from("brand_email_identity")
    .select("from_email, reply_to, display_name")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .maybeSingle();
  return {
    fromEmail: data?.from_email ?? null,
    replyTo: data?.reply_to ?? null,
    displayName: data?.display_name ?? null,
  };
}

/**
 * Costruisce il payload email per un reminder. In v1 usiamo template semplici
 * hardcoded; v2 potra' usare brand kit + AI per generare il testo.
 */
function buildEmailPayload(
  reminder: Reminder,
  contact: ContactInfo,
  fromEmail: string,
  replyTo: string | null,
): OutgoingMessage {
  const firstName = contact.firstName?.trim() || "ciao";
  const to = contact.email;
  if (!to) throw new Error("Contatto senza email");

  let subject: string;
  let html: string;
  switch (reminder.kind) {
    case "dormant_reactivation":
      subject = "Non ti vediamo da un po'";
      html = `<p>Ciao ${firstName},</p><p>ci sei mancato. Passa a trovarci quando puoi — vorremmo rivederti.</p>${reminder.messageHint ? `<p>${reminder.messageHint}</p>` : ""}`;
      break;
    case "review_request":
      subject = "Com'e' andata? Lasciaci due righe";
      html = `<p>Ciao ${firstName},</p><p>se ti e' piaciuta la nostra ospitalita', ci farebbe piacere una recensione.</p>${reminder.messageHint ? `<p>${reminder.messageHint}</p>` : ""}`;
      break;
    default:
      // fallback generico (non dovrebbe capitare in v1 — gli altri kind vanno su WA)
      subject = `Promemoria: ${reminder.kind}`;
      html = `<p>Ciao ${firstName},</p>${reminder.messageHint ? `<p>${reminder.messageHint}</p>` : "<p>(nessun messaggio aggiuntivo)</p>"}`;
  }

  const result: {
    channel: "email";
    to: string;
    subject: string;
    html: string;
    from: string;
    replyTo?: string;
  } = {
    channel: "email",
    to,
    subject,
    html,
    from: fromEmail,
  };
  if (replyTo) result.replyTo = replyTo;
  return result;
}

/**
 * Costruisce il payload WhatsApp per un reminder. In v1 serve un templateSid
 * pre-approvato per ogni kind (Twilio Content API). Il mapping templateSid vive
 * nel config del canale (channel_credentials.config.templates[kind]).
 */
function buildWhatsAppPayload(
  reminder: Reminder,
  contact: ContactInfo,
  templates: Record<string, string>,
  waFrom: string,
): OutgoingMessage {
  const to = contact.whatsappE164 ?? contact.phoneE164;
  if (!to) throw new Error("Contatto senza whatsapp/telefono E.164");
  const templateSid = templates[reminder.kind];
  if (!templateSid) {
    throw new Error(
      `Template WA mancante per kind=${reminder.kind}. Configuralo in Impostazioni → Canali di invio → WhatsApp → templates`,
    );
  }
  const firstName = contact.firstName?.trim() || "ciao";
  // Variabili template Twilio: posizionali "1", "2", ecc. Lasciamo al chiamante
  // la scelta dello schema. In v1 passiamo solo firstName + messageHint.
  const variables: Record<string, string> = {
    "1": firstName,
    "2": reminder.messageHint ?? "",
  };
  return {
    channel: "whatsapp",
    to,
    templateSid,
    variables,
    from: waFrom,
  };
}

export type SendReminderResult =
  { ok: true; jobId: string; channel: Channel } | { ok: false; error: string };

/**
 * Invia un reminder via M05 publish. Non aggiorna lo stato del reminder:
 * questo avviene via trigger DB `m09_sync_reminder_from_publish_log` quando
 * il worker M05 esegue l'invio e scrive su m05_publish_log.
 *
 * Ritorna il jobId del publish job accodato. Il chiamante lo salva in
 * reminders.publish_job_id per tracking.
 */
export async function sendReminderNow(
  reminderId: string,
  organizationId: string,
): Promise<SendReminderResult> {
  try {
    const reminder = await getReminder(reminderId, organizationId);
    if (!reminder) return { ok: false, error: "Promemoria non trovato" };
    if (reminder.status !== "pending") {
      return {
        ok: false,
        error: `Promemoria in stato ${reminder.status}, non puo' essere inviato`,
      };
    }
    const config = getChannelForReminderKind(reminder.kind);
    const contact = await loadContact(organizationId, reminder.contactId);
    if (!contact) return { ok: false, error: "Contatto associato al reminder non trovato" };

    let payload: OutgoingMessage;
    if (config.channel === "email") {
      const identity = await loadBrandIdentity(organizationId, reminder.brandId);
      if (!identity.fromEmail) {
        return {
          ok: false,
          error: "Brand email identity non configurata (from). Vai su Marchi → Email identity",
        };
      }
      payload = buildEmailPayload(reminder, contact, identity.fromEmail, identity.replyTo);
    } else if (config.channel === "whatsapp") {
      // Carica templates + waFrom dal canale WA
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = getAdminClient() as any;
      const { data: cred } = await admin
        .from("m05_channel_credentials")
        .select("config")
        .eq("organization_id", organizationId)
        .eq("channel", "whatsapp")
        .maybeSingle();
      const templates = (cred?.config?.templates ?? {}) as Record<string, string>;
      const waFrom = (cred?.config?.from as string | undefined) ?? "";
      if (!waFrom) {
        return {
          ok: false,
          error: "WhatsApp 'from' non configurato. Vai su Impostazioni → Canali di invio",
        };
      }
      payload = buildWhatsAppPayload(reminder, contact, templates, waFrom);
    } else {
      return { ok: false, error: `Canale ${config.channel} non supportato in v1` };
    }

    const job = await sendMessage({
      organizationId,
      channel: config.channel,
      recipientContactId: reminder.contactId,
      payload,
      sourceKind: "reminder",
      sourceId: reminder.id,
      isPromotional: config.isPromotional,
    });

    // Salva il publish_job_id sul reminder per tracking (status update sara' via trigger)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    await admin
      .from("reminders")
      .update({ publish_job_id: job.id, last_send_error: null })
      .eq("id", reminder.id)
      .eq("organization_id", organizationId);

    return { ok: true, jobId: job.id, channel: config.channel };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
