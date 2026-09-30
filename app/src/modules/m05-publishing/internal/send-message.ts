// M05 - orchestrator sendMessage: 6 gate + enqueue.

import type { OutgoingMessage, Channel } from "./types";
import {
  gateConsent, gateChannelEnabled, gateQuietHours, gatePressureLimit,
  gateGovernanceContent, gateBudget, gateRecipientMatchesContact, type SourceKind,
} from "./gates";
import { getChannelCredentials } from "./credentials-repo";
import { getAdapter } from "./adapter-registry";
import { enqueueJob, type Job } from "./publish-jobs-repo";

export type SendMessageInput = {
  organizationId: string;
  channel: Channel;
  recipientContactId: string | null;
  payload: OutgoingMessage;
  sourceKind: SourceKind;
  sourceId: string | null;
  isPromotional: boolean;
};

export async function sendMessage(input: SendMessageInput): Promise<Job> {
  const { organizationId, channel, recipientContactId, payload, sourceKind, sourceId, isPromotional } = input;

  // Recupera credenziali per estrarre provider (necessario per adapter)
  const creds = await getChannelCredentials(organizationId, channel);
  if (!creds) throw new Error(`Nessuna credenziale ${channel}`);

  // Gate 1: consent (fail-closed su null contactId per non-test)
  await gateConsent(organizationId, recipientContactId, channel, sourceKind);

  // Security gate: recipient in payload deve combaciare col contatto (previene consent laundering).
  // Se contactId=null (solo per sourceKind=test), usiamo payload.to as-is.
  let recipientAddress = payload.to;
  if (recipientContactId) {
    recipientAddress = await gateRecipientMatchesContact(organizationId, recipientContactId, channel, payload.to);
  }

  await gateChannelEnabled(organizationId, channel);
  const sendAfter = await gateQuietHours(organizationId, channel);
  await gatePressureLimit(organizationId, recipientContactId, channel, isPromotional);
  await gateGovernanceContent(organizationId, payload);

  // Gate 6: cost estimation
  const adapter = await getAdapter(channel, creds.provider);
  const estCost = await adapter.estimateCost(payload);
  await gateBudget(organizationId, channel, estCost);

  return enqueueJob({
    organizationId, channel, provider: creds.provider,
    recipientContactId, recipientAddress,
    sourceKind, sourceId, payload,
    isPromotional, costEstimateCents: estCost,
    sendAfter: sendAfter.toISOString(),
  });
}
