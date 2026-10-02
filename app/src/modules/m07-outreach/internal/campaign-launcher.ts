// M07 campaign launcher — RN-62 bulk send protection (3 layer).
//   Layer 1: preview (count + sample 3 contatti + payload compilato) + conferma via digit count
//   Layer 2: invio di prova all'Owner prima di partire
//   Layer 3: partenza scaglionata (staged_batch_size + staged_pause_seconds)
//
// Chiama M05 sendMessage per ogni destinatario con sourceKind='campaign' +
// sourceId=campaignId. Il dedupe_key di M05 (md5(source_kind:source_id:recipient))
// previene doppio invio se launch viene chiamato due volte.

import { getAdminClient } from "@/lib/db/admin";
import { sendMessage, DuplicateJobError } from "@/modules/m05-publishing/public";
import { getCampaign } from "./campaigns-repo";
import { listMatchingContactIds, countMatchingContacts } from "./segment-evaluator";
import type { SegmentCriteria, Campaign } from "./outreach-types";

export type CampaignSampleContact = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

export type CampaignPreview = {
  campaign: Campaign;
  segmentName: string | null;
  totalRecipients: number;
  sampleContacts: CampaignSampleContact[];
  resolvedSubject: string;
  resolvedBody: string;
  fromEmail: string | null;
  replyTo: string | null;
};

async function loadSegmentCriteria(
  segmentId: string,
  organizationId: string,
): Promise<{ brandId: string; name: string; criteria: SegmentCriteria } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contact_segments")
    .select("brand_id, name, criteria")
    .eq("id", segmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`loadSegment: ${error.message}`);
  if (!data) return null;
  return {
    brandId: data.brand_id as string,
    name: data.name as string,
    criteria: data.criteria as SegmentCriteria,
  };
}

async function loadContentDraft(
  draftId: string,
  organizationId: string,
): Promise<{ subject: string; body: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin
    .from("content_drafts")
    .select("theme_input, generated_text")
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return null;
  // Convention per F1: theme_input diventa oggetto email, generated_text il body.
  const theme = (data.theme_input as string | null) ?? "";
  const text = (data.generated_text as string | null) ?? "";
  return {
    subject: theme.length > 0 ? theme.slice(0, 100) : "Novità",
    body: text,
  };
}

async function loadBrandEmailIdentity(
  organizationId: string,
  brandId: string,
): Promise<{ fromEmail: string | null; replyTo: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // RF-2.2a: email identity vive su colonne di `brands`, non in tabella separata.
  const { data } = await admin
    .from("brands")
    .select("email_from_address, email_reply_to")
    .eq("organization_id", organizationId)
    .eq("id", brandId)
    .maybeSingle();
  return {
    fromEmail: (data?.email_from_address as string | null) ?? null,
    replyTo: (data?.email_reply_to as string | null) ?? null,
  };
}

function textToHtml(text: string): string {
  // Minimale: paragrafi su doppia newline, nessun escape pericoloso (il testo
  // viene da content_draft generato internamente, non da input utente).
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("\n");
}

/**
 * Layer 1 — Preview destinatari.
 * Mostra: numero esatto, nome segmento, 3 destinatari esempio, payload compilato.
 */
export async function previewCampaignRecipients(
  campaignId: string,
  organizationId: string,
): Promise<{ ok: true; preview: CampaignPreview } | { ok: false; error: string }> {
  const campaign = await getCampaign(campaignId, organizationId);
  if (!campaign) return { ok: false, error: "Campagna non trovata" };
  if (!campaign.segmentId) return { ok: false, error: "Campagna senza segmento" };
  if (!campaign.contentDraftId) return { ok: false, error: "Campagna senza draft contenuto" };
  if (campaign.channel !== "email") {
    return {
      ok: false,
      error: `Canale ${campaign.channel} non supportato in v1 bulk (solo email)`,
    };
  }

  const segment = await loadSegmentCriteria(campaign.segmentId, organizationId);
  if (!segment) return { ok: false, error: "Segmento non trovato" };

  const draft = await loadContentDraft(campaign.contentDraftId, organizationId);
  if (!draft) return { ok: false, error: "Draft contenuto non trovato" };

  const identity = await loadBrandEmailIdentity(organizationId, campaign.brandId);

  const totalRecipients = await countMatchingContacts(
    organizationId,
    campaign.brandId,
    segment.criteria,
  );

  // Sample 3 contatti random dal segmento (per preview)
  const allIds = await listMatchingContactIds(organizationId, campaign.brandId, segment.criteria);
  const sampleIds = allIds.slice(0, 3);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: sampleRows } =
    sampleIds.length > 0
      ? await admin
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .in("id", sampleIds)
      : { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sampleContacts: CampaignSampleContact[] = ((sampleRows ?? []) as any[]).map((r) => {
    const parts = [r.first_name, r.last_name].filter((v: string | null) => Boolean(v));
    return {
      id: r.id as string,
      fullName: parts.length > 0 ? parts.join(" ") : null,
      email: (r.email as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
    };
  });

  return {
    ok: true,
    preview: {
      campaign,
      segmentName: segment.name,
      totalRecipients,
      sampleContacts,
      resolvedSubject: draft.subject,
      resolvedBody: draft.body,
      fromEmail: identity.fromEmail,
      replyTo: identity.replyTo,
    },
  };
}

export type SendTestInput = {
  campaignId: string;
  organizationId: string;
  recipientEmail: string;
};

/**
 * Layer 2 — Invio di prova all'Owner.
 * Chiama M05 sendMessage con sourceKind='test', recipientContactId=null.
 */
export async function sendCampaignTest(
  input: SendTestInput,
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const campaign = await getCampaign(input.campaignId, input.organizationId);
  if (!campaign) return { ok: false, error: "Campagna non trovata" };
  if (!campaign.contentDraftId) return { ok: false, error: "Campagna senza draft" };
  if (campaign.channel !== "email") {
    return { ok: false, error: `Canale ${campaign.channel} non supportato` };
  }

  const draft = await loadContentDraft(campaign.contentDraftId, input.organizationId);
  if (!draft) return { ok: false, error: "Draft contenuto non trovato" };

  const identity = await loadBrandEmailIdentity(input.organizationId, campaign.brandId);
  if (!identity.fromEmail) {
    return { ok: false, error: "Brand email identity non configurato (from)" };
  }

  try {
    const payload: Parameters<typeof sendMessage>[0]["payload"] = {
      channel: "email",
      to: input.recipientEmail,
      subject: `[TEST] ${draft.subject}`,
      html: textToHtml(draft.body),
      from: identity.fromEmail,
    };
    if (identity.replyTo) {
      (payload as { replyTo?: string }).replyTo = identity.replyTo;
    }
    const job = await sendMessage({
      organizationId: input.organizationId,
      channel: "email",
      recipientContactId: null,
      payload,
      sourceKind: "test",
      sourceId: campaign.id,
      isPromotional: false, // test interno non conta come promo
    });

    // Marker test send
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    await admin
      .from("campaigns")
      .update({ test_sent_at: new Date().toISOString(), test_sent_to: input.recipientEmail })
      .eq("id", campaign.id)
      .eq("organization_id", input.organizationId);

    return { ok: true, jobId: job.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type LaunchInput = {
  campaignId: string;
  organizationId: string;
  confirmedCount: number;
};

export type LaunchResult = {
  ok: true;
  enqueued: number;
  skipped: number;
  errors: Array<{ contactId: string; error: string }>;
};

/**
 * Layer 3 — Partenza scaglionata.
 * Richiede confirmedCount == count reale (prevenzione click accidentale).
 * Enqueue in M05 per ogni contatto con send_after calcolato: batch_i * pause.
 */
export async function launchCampaign(
  input: LaunchInput,
): Promise<LaunchResult | { ok: false; error: string }> {
  const campaign = await getCampaign(input.campaignId, input.organizationId);
  if (!campaign) return { ok: false, error: "Campagna non trovata" };
  if (!campaign.segmentId) return { ok: false, error: "Campagna senza segmento" };
  if (!campaign.contentDraftId) return { ok: false, error: "Campagna senza draft" };
  if (campaign.channel !== "email") {
    return { ok: false, error: `Canale ${campaign.channel} non supportato in v1 bulk` };
  }
  if (!(["draft", "scheduled"] as string[]).includes(campaign.status)) {
    return { ok: false, error: `Campagna in stato ${campaign.status}, non lanciabile` };
  }

  const segment = await loadSegmentCriteria(campaign.segmentId, input.organizationId);
  if (!segment) return { ok: false, error: "Segmento non trovato" };

  const draft = await loadContentDraft(campaign.contentDraftId, input.organizationId);
  if (!draft) return { ok: false, error: "Draft non trovato" };

  const identity = await loadBrandEmailIdentity(input.organizationId, campaign.brandId);
  if (!identity.fromEmail) {
    return { ok: false, error: "Brand email identity non configurato" };
  }

  // Guardia conferma numero (RN-62 layer 1).
  const actualIds = await listMatchingContactIds(
    input.organizationId,
    campaign.brandId,
    segment.criteria,
  );
  if (actualIds.length !== input.confirmedCount) {
    return {
      ok: false,
      error: `Numero destinatari non combacia: digitato ${input.confirmedCount}, reale ${actualIds.length}. Il segmento potrebbe essere cambiato dopo la preview.`,
    };
  }
  if (actualIds.length === 0) {
    return { ok: false, error: "Nessun destinatario nel segmento" };
  }

  const htmlBody = textToHtml(draft.body);
  const batchSize = Math.max(1, campaign.plannedAt ? 100 : 100); // v1: usiamo default
  const pauseSeconds = 600;

  // Carica emails dei destinatari in blocco
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: contactRows, error: cErr } = await admin
    .from("contacts")
    .select("id, email")
    .in("id", actualIds);
  if (cErr) return { ok: false, error: `load contacts: ${cErr.message}` };
  const emailMap = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (contactRows ?? []) as any[]) {
    if (r.email) emailMap.set(r.id as string, r.email as string);
  }

  // Transizione a sending prima dell'enqueue (evita doppio launch concorrente)
  const launchedAt = new Date().toISOString();
  const { data: statusUpdated, error: statusErr } = await admin
    .from("campaigns")
    .update({
      status: "sending",
      launched_at: launchedAt,
      staged_batch_size: batchSize,
      staged_pause_seconds: pauseSeconds,
    })
    .eq("id", campaign.id)
    .eq("organization_id", input.organizationId)
    .in("status", ["draft", "scheduled"])
    .select("id")
    .maybeSingle();
  if (statusErr) return { ok: false, error: `status transition: ${statusErr.message}` };
  if (!statusUpdated) {
    return { ok: false, error: "Campagna lanciata da un'altra sessione (race)" };
  }

  const now = Date.now();
  let enqueued = 0;
  let skipped = 0;
  const errors: Array<{ contactId: string; error: string }> = [];

  for (let i = 0; i < actualIds.length; i++) {
    const contactId = actualIds[i]!;
    const email = emailMap.get(contactId);
    if (!email) {
      skipped++;
      continue;
    }
    const batchIndex = Math.floor(i / batchSize);
    const sendAfterMs = now + batchIndex * pauseSeconds * 1000;
    try {
      const payload: Parameters<typeof sendMessage>[0]["payload"] = {
        channel: "email",
        to: email,
        subject: draft.subject,
        html: htmlBody,
        from: identity.fromEmail,
      };
      if (identity.replyTo) (payload as { replyTo?: string }).replyTo = identity.replyTo;
      await sendMessage({
        organizationId: input.organizationId,
        channel: "email",
        recipientContactId: contactId,
        payload,
        sourceKind: "campaign",
        sourceId: campaign.id,
        isPromotional: true, // campagne email sono promozionali per definizione (RF-5.5a non si applica a email)
      });
      enqueued++;
    } catch (err) {
      if (err instanceof DuplicateJobError) {
        skipped++;
        continue;
      }
      errors.push({ contactId, error: (err as Error).message });
      skipped++;
    }
  }

  await admin
    .from("campaigns")
    .update({ enqueued_count: enqueued })
    .eq("id", campaign.id)
    .eq("organization_id", input.organizationId);

  return { ok: true, enqueued, skipped, errors };
}

/**
 * Annulla una campagna in corso: solo prima o durante sending (non dopo sent).
 * NB: i job gia' accodati in M05 non vengono rimossi (sarebbe cross-module intrusion).
 * In v2 si potra' aggiungere un cancel_all_jobs_for_source RPC in M05.
 */
export async function cancelLaunchedCampaign(
  campaignId: string,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("campaigns")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .in("status", ["draft", "scheduled", "sending"])
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Campagna non annullabile (gia sent o cancelled)" };
  return { ok: true };
}
