// M03 — Repository content_drafts.
// RS-2: usa getAdminClient() wrapper Supabase, mai SDK diretto.
// Cast `as any` in linea col pattern F1.2 brand-kit-repo (tipi Supabase
// non ancora generati — debito noto, task futuro F0-b).

import { getAdminClient } from "@/lib/db/admin";
import type { ContentDraft, ContentChannel, ContentDraftStatus } from "./content-drafts-types";

// Row snake_case da DB → ContentDraft camelCase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDraft(row: any): ContentDraft {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    channel: row.channel as ContentChannel,
    themeInput: row.theme_input,
    generatedText: row.generated_text,
    promptVersion: row.prompt_version,
    modelUsed: row.model_used,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: Number(row.cost_usd),
    latencyMs: row.latency_ms,
    status: row.status as ContentDraftStatus,
    rejectionReason: row.rejection_reason ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
    rejectedAt: row.rejected_at ?? null,
  };
}

const SELECT_COLS =
  "id, organization_id, brand_id, channel, theme_input, generated_text, " +
  "prompt_version, model_used, tokens_in, tokens_out, cost_usd, latency_ms, " +
  "status, rejection_reason, created_by, created_at, approved_at, rejected_at";

export async function listContentDraftsByBrand(
  brandId: string,
  limit: number = 20,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lettura drafts: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToDraft);
}

/**
 * Tenant-scoped: filtra su organization_id per prevenire IDOR cross-tenant.
 * Restituisce null se il draft non esiste O appartiene a un'altra org.
 */
export async function getContentDraft(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura draft: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

export type InsertDraftInput = {
  organizationId: string;
  brandId: string;
  channel: ContentChannel;
  themeInput: string;
  generatedText: string;
  promptVersion: string;
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  createdBy: string;
};

export async function insertDraft(input: InsertDraftInput): Promise<ContentDraft> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .insert({
      organization_id: input.organizationId,
      brand_id: input.brandId,
      channel: input.channel,
      theme_input: input.themeInput,
      generated_text: input.generatedText,
      prompt_version: input.promptVersion,
      model_used: input.modelUsed,
      tokens_in: input.tokensIn,
      tokens_out: input.tokensOut,
      cost_usd: input.costUsd,
      latency_ms: input.latencyMs,
      created_by: input.createdBy,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore inserimento draft: ${error.message}`);
  return rowToDraft(data);
}

export async function markApproved(draftId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("content_drafts")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) throw new Error(`Errore approvazione draft: ${error.message}`);
}

export type MarkRejectedInput = {
  draftId: string;
  reason: string;
  reasonEmbedding: number[]; // array vuoto se Voyage down → salva null
};

export async function markRejected(input: MarkRejectedInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: "rejected",
    rejected_at: new Date().toISOString(),
    rejection_reason: input.reason,
  };
  if (input.reasonEmbedding.length === 512) {
    // Supabase JS: pgvector accetta string "[v1,v2,...]" o array puro.
    patch["rejection_reason_embedding"] = input.reasonEmbedding;
  }
  const { error } = await admin.from("content_drafts").update(patch).eq("id", input.draftId);
  if (error) throw new Error(`Errore rifiuto draft: ${error.message}`);
}

export async function fetchRecentApprovedByBrand(
  brandId: string,
  limit: number = 3,
): Promise<Array<Pick<ContentDraft, "themeInput" | "generatedText">>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select("theme_input, generated_text")
    .eq("brand_id", brandId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lettura approvati: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    themeInput: r.theme_input as string,
    generatedText: r.generated_text as string,
  }));
}

export async function fetchSimilarRejectionsByBrand(
  brandId: string,
  themeEmbedding: number[],
  limit: number = 3,
): Promise<Array<{ themeInput: string; generatedText: string; rejectionReason: string }>> {
  if (themeEmbedding.length !== 512) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.rpc("fetch_similar_rejections", {
    p_brand_id: brandId,
    p_embedding: themeEmbedding,
    p_limit: limit,
  });
  if (error) throw new Error(`Errore retrieval rifiuti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    themeInput: r.theme_input as string,
    generatedText: r.generated_text as string,
    rejectionReason: r.rejection_reason as string,
  }));
}

// Anti-slot-machine: verifica che l'ultimo draft dello stesso (brand, user) sia
// più vecchio di minGapSeconds. Prima invocazione (0 draft): ritorna false.
export async function isRateLimited(
  brandId: string,
  userId: string,
  minGapSeconds: number = 10,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select("created_at")
    .eq("brand_id", brandId)
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica rate limit: ${error.message}`);
  if (!data) return false;
  const lastMs = new Date((data as { created_at: string }).created_at).getTime();
  return Date.now() - lastMs < minGapSeconds * 1000;
}
