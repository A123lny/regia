"use server";

// M07 — server actions per segmenti e campagne.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { upsertSegment, refreshSegmentCount } from "./segments-repo";
import { upsertCampaign, markCampaignSent, cancelCampaign, getCampaign } from "./campaigns-repo";
import { countMatchingContacts } from "./segment-evaluator";
import type { CampaignChannel, SegmentCriteria } from "./outreach-types";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

async function requireOwnedBrand(brandId: string, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, organization_id, is_archived")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Marchio non trovato");
  if (data.organization_id !== organizationId) throw new Error("Accesso negato al marchio");
  if (data.is_archived) throw new Error("Marchio archiviato");
  return data as { id: string; slug: string };
}

// ============================================================================
// Segment CRUD
// ============================================================================

export type UpsertSegmentActionInput = {
  segmentId?: string;
  brandId: string;
  name: string;
  description?: string;
  criteria: SegmentCriteria;
  isActive: boolean;
};

export async function upsertSegmentAction(
  input: UpsertSegmentActionInput,
): Promise<{ ok: true; segmentId: string; count: number } | { ok: false; error: string }> {
  const session = await requireAuth("segment.crud");
  await requireOwnedBrand(input.brandId, session.organizationId);
  try {
    const upsertInput: Parameters<typeof upsertSegment>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      name: input.name,
      criteria: input.criteria,
      isActive: input.isActive,
    };
    if (input.segmentId) upsertInput.segmentId = input.segmentId;
    if (input.description !== undefined) upsertInput.description = input.description;

    const seg = await upsertSegment(upsertInput);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.segmentId ? "outreach.segment_updated" : "outreach.segment_created",
      target: `brand:${input.brandId}`,
      details: {
        segmentId: seg.id,
        name: seg.name,
        contactCount: seg.contactCountMaterialized,
      },
    });

    revalidatePath("/segmenti");
    return { ok: true, segmentId: seg.id, count: seg.contactCountMaterialized };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function refreshSegmentAction(
  segmentId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireAuth("segment.read");
  const seg = await refreshSegmentCount(segmentId, session.organizationId);
  if (!seg) return { ok: false, error: "Segmento non trovato" };
  revalidatePath("/segmenti");
  return { ok: true, count: seg.contactCountMaterialized };
}

export async function previewSegmentAction(input: {
  brandId: string;
  criteria: SegmentCriteria;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireAuth("segment.read");
  await requireOwnedBrand(input.brandId, session.organizationId);
  try {
    const count = await countMatchingContacts(
      session.organizationId,
      input.brandId,
      input.criteria,
    );
    return { ok: true, count };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// Campaign CRUD
// ============================================================================

export type UpsertCampaignActionInput = {
  campaignId?: string;
  brandId: string;
  segmentId?: string;
  contentDraftId?: string;
  name: string;
  channel: CampaignChannel;
  plannedAt?: string;
  notes?: string;
};

export async function upsertCampaignAction(
  input: UpsertCampaignActionInput,
): Promise<{ ok: true; campaignId: string } | { ok: false; error: string }> {
  const session = await requireAuth("campaign.crud");
  await requireOwnedBrand(input.brandId, session.organizationId);
  try {
    const payload: Parameters<typeof upsertCampaign>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      name: input.name,
      channel: input.channel,
    };
    if (input.campaignId) payload.campaignId = input.campaignId;
    if (input.segmentId) payload.segmentId = input.segmentId;
    if (input.contentDraftId) payload.contentDraftId = input.contentDraftId;
    if (input.plannedAt) payload.plannedAt = input.plannedAt;
    if (input.notes !== undefined) payload.notes = input.notes;

    const camp = await upsertCampaign(payload);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.campaignId ? "outreach.campaign_updated" : "outreach.campaign_created",
      target: `brand:${input.brandId}`,
      details: {
        campaignId: camp.id,
        name: camp.name,
        channel: camp.channel,
        status: camp.status,
      },
    });

    revalidatePath("/campagne");
    return { ok: true, campaignId: camp.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type MarkCampaignSentInput = {
  campaignId: string;
  attempted: number;
  delivered: number;
  failed: number;
  notes?: string;
};

export async function markCampaignSentAction(
  input: MarkCampaignSentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("campaign.mark_sent");
  const camp = await getCampaign(input.campaignId, session.organizationId);
  if (!camp) return { ok: false, error: "Campagna non trovata" };
  if (input.attempted < 0 || input.delivered < 0 || input.failed < 0) {
    return { ok: false, error: "Contatori negativi non ammessi" };
  }
  if (input.delivered + input.failed > input.attempted) {
    return { ok: false, error: "delivered + failed non può superare attempted" };
  }
  const markInput: Parameters<typeof markCampaignSent>[2] = {
    attempted: input.attempted,
    delivered: input.delivered,
    failed: input.failed,
  };
  if (input.notes !== undefined) markInput.notes = input.notes;
  const updated = await markCampaignSent(input.campaignId, session.organizationId, markInput);
  if (!updated) return { ok: false, error: "Campagna non in stato draft/scheduled" };

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "outreach.campaign_marked_sent",
    target: `campaign:${input.campaignId}`,
    details: {
      attempted: input.attempted,
      delivered: input.delivered,
      failed: input.failed,
    },
  });

  revalidatePath("/campagne");
  return { ok: true };
}

export async function cancelCampaignAction(campaignId: string): Promise<void> {
  const session = await requireAuth("campaign.crud");
  const camp = await getCampaign(campaignId, session.organizationId);
  if (!camp) throw new Error("Campagna non trovata");
  const ok = await cancelCampaign(campaignId, session.organizationId);
  if (!ok) throw new Error("Campagna non annullabile (già inviata o annullata)");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "outreach.campaign_cancelled",
    target: `campaign:${campaignId}`,
    details: { previousStatus: camp.status },
  });
  revalidatePath("/campagne");
}

// ============================================================================
// RN-62 Bulk send protection (preview + test + staged launch)
// ============================================================================

import {
  previewCampaignRecipients,
  sendCampaignTest,
  launchCampaign,
  cancelLaunchedCampaign,
  type CampaignPreview,
  type LaunchResult,
} from "./campaign-launcher";

export async function previewCampaignRecipientsAction(
  campaignId: string,
): Promise<{ ok: true; preview: CampaignPreview } | { ok: false; error: string }> {
  const session = await requireAuth("campaign.read");
  return previewCampaignRecipients(campaignId, session.organizationId);
}

export async function sendCampaignTestAction(input: {
  campaignId: string;
  recipientEmail: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "campaign.read");
  requireCapability(session, "publishing.send");
  if (!input.recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail)) {
    return { ok: false, error: "Email di prova non valida" };
  }
  const result = await sendCampaignTest({
    campaignId: input.campaignId,
    organizationId: session.organizationId,
    recipientEmail: input.recipientEmail,
  });
  if (result.ok) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "outreach.campaign_test_sent",
      target: `campaign:${input.campaignId}`,
      details: { recipientEmail: input.recipientEmail, jobId: result.jobId },
    });
    revalidatePath("/campagne");
  }
  return result;
}

export async function launchCampaignAction(input: {
  campaignId: string;
  confirmedCount: number;
}): Promise<LaunchResult | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "campaign.crud");
  requireCapability(session, "publishing.send_bulk");
  const result = await launchCampaign({
    campaignId: input.campaignId,
    organizationId: session.organizationId,
    confirmedCount: input.confirmedCount,
  });
  if (result.ok) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "outreach.campaign_launched",
      target: `campaign:${input.campaignId}`,
      details: {
        confirmedCount: input.confirmedCount,
        enqueued: result.enqueued,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });
    revalidatePath("/campagne");
  }
  return result;
}

export async function cancelLaunchedCampaignAction(
  campaignId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "campaign.crud");
  const result = await cancelLaunchedCampaign(campaignId, session.organizationId);
  if (result.ok) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "outreach.campaign_cancelled_sending",
      target: `campaign:${campaignId}`,
    });
    revalidatePath("/campagne");
  }
  return result;
}
