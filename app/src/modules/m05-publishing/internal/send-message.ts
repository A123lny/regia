// M05 - orchestrator sendMessage: 6 gate + enqueue.

import type { OutgoingMessage, Channel } from "./types";
import {
  gateConsent,
  gateChannelEnabled,
  gateQuietHours,
  gatePressureLimit,
  gateGovernanceContent,
  gateBudget,
  gateRecipientMatchesContact,
  type SourceKind,
} from "./gates";
import { getChannelCredentials } from "./credentials-repo";
import { getAdapter } from "./adapter-registry";
import { enqueueJob, type Job } from "./publish-jobs-repo";
import { createUnsubscribeToken } from "./unsubscribe-repo";

function getAppBaseUrl(): string {
  return process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["APP_URL"] ?? "http://localhost:3000";
}

function injectUnsubscribeFooter(html: string, token: string): string {
  const url = `${getAppBaseUrl()}/u/${token}`;
  // Footer unobtrusive. Appende DOPO il contenuto (prima di eventuale </body>).
  const footer =
    `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>` +
    `<p style="font-size:12px;color:#6b7280;margin:12px 0">` +
    `Non vuoi ricevere piu' queste email? ` +
    `<a href="${url}" style="color:#6b7280;text-decoration:underline">Disiscriviti qui</a>` +
    `</p>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return html + footer;
}

export type SendMessageInput = {
  organizationId: string;
  channel: Channel;
  recipientContactId: string | null;
  payload: OutgoingMessage;
  sourceKind: SourceKind;
  sourceId: string | null;
  isPromotional: boolean;
  /** Override send_after (es. partenza scaglionata RN-62). Se > now, posticipa l'invio. */
  sendAfterOverrideIso?: string;
};

export async function sendMessage(input: SendMessageInput): Promise<Job> {
  const {
    organizationId,
    channel,
    recipientContactId,
    payload,
    sourceKind,
    sourceId,
    isPromotional,
    sendAfterOverrideIso,
  } = input;

  // Recupera credenziali per estrarre provider (necessario per adapter)
  const creds = await getChannelCredentials(organizationId, channel);
  if (!creds) throw new Error(`Nessuna credenziale ${channel}`);

  // Gate 1: consent (fail-closed su null contactId per non-test)
  await gateConsent(organizationId, recipientContactId, channel, sourceKind);

  // Security gate: recipient in payload deve combaciare col contatto (previene consent laundering).
  // Se contactId=null (solo per sourceKind=test), usiamo payload.to as-is.
  let recipientAddress = payload.to;
  if (recipientContactId) {
    recipientAddress = await gateRecipientMatchesContact(
      organizationId,
      recipientContactId,
      channel,
      payload.to,
    );
  }

  await gateChannelEnabled(organizationId, channel);
  const sendAfter = await gateQuietHours(organizationId, channel);
  await gatePressureLimit(organizationId, recipientContactId, channel, isPromotional);
  await gateGovernanceContent();

  // Gate 6: cost estimation
  const adapter = await getAdapter(channel, creds.provider);
  const estCost = await adapter.estimateCost(payload);
  await gateBudget(organizationId, channel, estCost);

  // RN-64: inietta link di disiscrizione per email con contact noto.
  // Il token punta a (org, contact, channel) e consumera' il consent al click.
  // Per sourceKind='test' (invio prova a Owner) saltiamo il footer (non e' spam da revocare).
  let finalPayload: OutgoingMessage = payload;
  if (channel === "email" && recipientContactId && sourceKind !== "test") {
    const token = await createUnsubscribeToken({
      organizationId,
      contactId: recipientContactId,
      channel,
      sourceKind,
      ...(sourceId ? { sourceId } : {}),
    });
    if (payload.channel === "email") {
      finalPayload = { ...payload, html: injectUnsubscribeFooter(payload.html, token) };
    }
  }

  // sendAfterOverrideIso ha precedenza su quiet hours se e' nel futuro
  // (es. partenza scaglionata campaign: batch_index * pause).
  const effectiveSendAfter = (() => {
    if (sendAfterOverrideIso) {
      const overrideMs = new Date(sendAfterOverrideIso).getTime();
      const quietMs = sendAfter.getTime();
      return new Date(Math.max(overrideMs, quietMs)).toISOString();
    }
    return sendAfter.toISOString();
  })();

  return enqueueJob({
    organizationId,
    channel,
    provider: creds.provider,
    recipientContactId,
    recipientAddress,
    sourceKind,
    sourceId,
    payload: finalPayload,
    isPromotional,
    costEstimateCents: estCost,
    sendAfter: effectiveSendAfter,
  });
}
