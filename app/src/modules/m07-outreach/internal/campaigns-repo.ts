// M07 — repo campagne (predisposizione, invio effettivo in M5).

import { getAdminClient } from "@/lib/db/admin";
import type { Campaign, CampaignChannel, CampaignStatus } from "./outreach-types";

const SELECT_COLS =
  "id, organization_id, brand_id, segment_id, content_draft_id, name, channel, status, " +
  "planned_at, sent_at, attempted_count, delivered_count, failed_count, notes, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    segmentId: row.segment_id ?? null,
    contentDraftId: row.content_draft_id ?? null,
    name: row.name,
    channel: row.channel as CampaignChannel,
    status: row.status as CampaignStatus,
    plannedAt: row.planned_at ?? null,
    sentAt: row.sent_at ?? null,
    attemptedCount: row.attempted_count,
    deliveredCount: row.delivered_count,
    failedCount: row.failed_count,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CampaignRow = Campaign & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  segmentName: string | null;
};

export async function listCampaigns(
  organizationId: string,
  brandId?: string,
  status?: CampaignStatus,
): Promise<CampaignRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("campaigns")
    .select(
      `${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived), contact_segments(name)`,
    )
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false);
  if (brandId) q = q.eq("brand_id", brandId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`Errore lista campagne: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): CampaignRow => ({
    ...rowToCampaign(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
    segmentName: (row.contact_segments?.name as string | null) ?? null,
  }));
}

export async function getCampaign(
  campaignId: string,
  organizationId: string,
): Promise<Campaign | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("campaigns")
    .select(SELECT_COLS)
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura campagna: ${error.message}`);
  return data ? rowToCampaign(data) : null;
}

export type UpsertCampaignInput = {
  organizationId: string;
  campaignId?: string;
  brandId: string;
  segmentId?: string | null;
  contentDraftId?: string | null;
  name: string;
  channel: CampaignChannel;
  plannedAt?: string | null;
  notes?: string | null;
};

export async function upsertCampaign(input: UpsertCampaignInput): Promise<Campaign> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const status = input.plannedAt ? "scheduled" : "draft";
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    segment_id: input.segmentId ?? null,
    content_draft_id: input.contentDraftId ?? null,
    name: input.name.trim(),
    channel: input.channel,
    status,
    planned_at: input.plannedAt ?? null,
    notes: input.notes ?? null,
  };
  if (input.campaignId) {
    const { data, error } = await admin
      .from("campaigns")
      .update(row)
      .eq("id", input.campaignId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore update campagna: ${error.message}`);
    return rowToCampaign(data);
  } else {
    const { data, error } = await admin.from("campaigns").insert(row).select(SELECT_COLS).single();
    if (error) throw new Error(`Errore insert campagna: ${error.message}`);
    return rowToCampaign(data);
  }
}

/**
 * Marker manuale "inviata": finché M5 non fa l'invio reale, l'operatore riporta l'esito qui.
 */
export async function markCampaignSent(
  campaignId: string,
  organizationId: string,
  input: { attempted: number; delivered: number; failed: number; notes?: string | null },
): Promise<Campaign | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: "sent",
    sent_at: new Date().toISOString(),
    attempted_count: input.attempted,
    delivered_count: input.delivered,
    failed_count: input.failed,
  };
  if (input.notes !== undefined) patch["notes"] = input.notes;
  const { data, error } = await admin
    .from("campaigns")
    .update(patch)
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .in("status", ["draft", "scheduled"])
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore mark sent: ${error.message}`);
  return data ? rowToCampaign(data) : null;
}

export async function cancelCampaign(
  campaignId: string,
  organizationId: string,
): Promise<Campaign | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .in("status", ["draft", "scheduled"])
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore cancel: ${error.message}`);
  return data ? rowToCampaign(data) : null;
}
