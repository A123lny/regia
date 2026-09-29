// M03 — RF-3.6 Sessione a doppia copertura guidata.
// Query cross-brand delle bozze in stato 'draft' che l'Owner deve processare.
// Ordine: create_at asc (le piu vecchie prima, per svuotare il backlog).

import { getAdminClient } from "@/lib/db/admin";
import type { ContentDraft } from "./content-drafts-types";

export type SessionDraft = ContentDraft & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

const SELECT_COLS =
  "id, organization_id, brand_id, channel, theme_input, generated_text, " +
  "prompt_version, model_used, tokens_in, tokens_out, cost_usd, latency_ms, " +
  "status, rejection_reason, created_by, created_at, approved_at, rejected_at, " +
  "scheduled_at, published_at, plan_batch_id, media_asset_id, topic_label";

/**
 * Ritorna tutte le bozze in stato 'draft' per l'organizzazione,
 * opzionalmente filtrate per planBatchId.
 * Il wizard le scorre una alla volta.
 */
export async function listPendingDraftsForSession(
  organizationId: string,
  filters?: { planBatchId?: string },
): Promise<SessionDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let query = admin
    .from("content_drafts")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .eq("brands.is_archived", false)
    .order("created_at", { ascending: true });
  if (filters?.planBatchId) {
    query = query.eq("plan_batch_id", filters.planBatchId);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Errore lettura sessione: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    channel: row.channel,
    themeInput: row.theme_input,
    generatedText: row.generated_text,
    promptVersion: row.prompt_version,
    modelUsed: row.model_used,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: Number(row.cost_usd),
    latencyMs: row.latency_ms,
    status: row.status,
    rejectionReason: row.rejection_reason ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    scheduledAt: row.scheduled_at ?? null,
    publishedAt: row.published_at ?? null,
    planBatchId: row.plan_batch_id ?? null,
    mediaAssetId: row.media_asset_id ?? null,
    topicLabel: row.topic_label ?? null,
    brandSlug: row.brands.slug,
    brandDisplayName: row.brands.display_name,
    brandColor: row.brands.color,
  }));
}
