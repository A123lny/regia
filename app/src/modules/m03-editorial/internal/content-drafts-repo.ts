// M03 — Repository content_drafts.
// RS-2: usa getAdminClient() wrapper Supabase, mai SDK diretto.
// Cast `as any` in linea col pattern F1.2 brand-kit-repo (tipi Supabase
// non ancora generati — debito noto, task futuro F0-b).

import { getAdminClient } from "@/lib/db/admin";
import type { ContentDraft, ContentChannel, ContentDraftStatus } from "./content-drafts-types";
import { classifyTopicLabel } from "./topic-classifier";

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
    scheduledAt: row.scheduled_at ?? null,
    publishedAt: row.published_at ?? null,
    planBatchId: row.plan_batch_id ?? null,
    mediaAssetId: row.media_asset_id ?? null,
    topicLabel: row.topic_label ?? null,
  };
}

const SELECT_COLS =
  "id, organization_id, brand_id, channel, theme_input, generated_text, " +
  "prompt_version, model_used, tokens_in, tokens_out, cost_usd, latency_ms, " +
  "status, rejection_reason, created_by, created_at, approved_at, rejected_at, " +
  "scheduled_at, published_at, plan_batch_id, media_asset_id, topic_label";

/**
 * Tenant-scoped: filtra su organization_id per prevenire IDOR cross-tenant (RN-87).
 * Coerente con getContentDraft.
 */
export async function listContentDraftsByBrand(
  brandId: string,
  organizationId: string,
  limit: number = 20,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("brand_id", brandId)
    .eq("organization_id", organizationId)
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
  planBatchId?: string; // RF-3.1: raggruppamento piano multi-post
};

export async function insertDraft(input: InsertDraftInput): Promise<ContentDraft> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const insertRow: Record<string, unknown> = {
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
    topic_label: classifyTopicLabel(input.themeInput),
  };
  if (input.planBatchId !== undefined) insertRow["plan_batch_id"] = input.planBatchId;
  const { data, error } = await admin
    .from("content_drafts")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore inserimento draft: ${error.message}`);
  return rowToDraft(data);
}

/**
 * Tenant-scoped: lista drafts di un piano specifico. Usato dalla vista
 * /contenuti/[slug]?planBatchId=xxx per mostrare solo le bozze del piano appena
 * generato, e dal wizard RF-3.6 per approvare 14 draft in blocco.
 */
export async function listDraftsByPlanBatch(
  organizationId: string,
  planBatchId: string,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("plan_batch_id", planBatchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Errore lettura piano: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToDraft);
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

/**
 * Tenant-scoped: passa status da 'approved' a 'scheduled' + set scheduled_at.
 * Guardia contro race: filtra su status='approved', se il draft è già in altro
 * stato ritorna null (0 righe update).
 */
export async function scheduleDraft(
  draftId: string,
  organizationId: string,
  scheduledAtIso: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ status: "scheduled", scheduled_at: scheduledAtIso })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore programmazione draft: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: cambia solo scheduled_at, mantenendo status='scheduled'.
 * Usato dal drag verticale nella day-view per riprogrammare l'orario.
 * Guardia contro race: filtra su status='scheduled'.
 */
export async function rescheduleDraft(
  draftId: string,
  organizationId: string,
  scheduledAtIso: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ scheduled_at: scheduledAtIso })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore riprogrammazione draft: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: DELETE hard di un draft. Guardia applicativa: mai eliminare
 * un draft 'published' (integrita audit — cio che e stato pubblicato non sparisce
 * dallo storico). Ritorna false se il delete non ha matchato (già eliminato o published).
 */
export async function deleteDraft(draftId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("content_drafts")
    .delete({ count: "exact" })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .neq("status", "published");
  if (error) throw new Error(`Errore eliminazione draft: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Tenant-scoped: passa status da 'scheduled' a 'approved' + azzera scheduled_at.
 * Guardia contro race: filtra su status='scheduled'.
 */
export async function unscheduleDraft(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ status: "approved", scheduled_at: null })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore annullamento programmazione: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: passa status da 'scheduled' a 'published' + set published_at = now().
 * published_at generato lato DB con now(). Guardia contro race: filtra su status='scheduled'.
 */
export async function markPublished(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore marcatura pubblicato: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: lista drafts scheduled+published del brand nel range [from, to).
 * Usato dal calendario editoriale per popolare le celle 14gg.
 */
export async function listScheduledByBrandBetween(
  brandId: string,
  organizationId: string,
  fromIsoInclusive: string,
  toIsoExclusive: string,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("brand_id", brandId)
    .eq("organization_id", organizationId)
    .in("status", ["scheduled", "published"])
    .gte("scheduled_at", fromIsoInclusive)
    .lt("scheduled_at", toIsoExclusive)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(`Errore lettura calendario: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToDraft);
}

/**
 * Tenant-scoped: elenco cross-brand di drafts filtrati per stato. Include brand_slug
 * e brand_display_name via join per rendering della chip marchio nella tabella.
 * Usato dalla vista `/contenuti?status=<x>` (elenchi filtrati dalla home M12).
 */
export async function listContentDraftsByStatus(
  organizationId: string,
  status: ContentDraftStatus,
  limit: number = 100,
): Promise<
  Array<
    ContentDraft & {
      brandSlug: string;
      brandDisplayName: string;
      brandColor: string;
    }
  >
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .eq("status", status)
    .eq("brands.is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lettura drafts per stato: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    ...rowToDraft(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
}

/**
 * Tenant-scoped: drafts scheduled+published cross-brand nel range [from, to).
 * Include brand slug/display_name per il calendario editoriale globale.
 */
export async function listScheduledByOrgBetween(
  organizationId: string,
  fromIsoInclusive: string,
  toIsoExclusive: string,
): Promise<
  Array<
    ContentDraft & {
      brandSlug: string;
      brandDisplayName: string;
      brandColor: string;
    }
  >
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .in("status", ["scheduled", "published"])
    .eq("brands.is_archived", false)
    .gte("scheduled_at", fromIsoInclusive)
    .lt("scheduled_at", toIsoExclusive)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(`Errore lettura calendario org: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    ...rowToDraft(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
}

/**
 * Tenant-scoped: drafts scheduled+published cross-brand in un singolo giorno locale.
 * Il range è [startOfDay, startOfDay + 24h) espresso come ISO UTC dal chiamante.
 * Usato dalla vista giorno /contenuti/calendario/[date].
 */
export async function listByOrgOnDay(
  organizationId: string,
  fromIsoInclusive: string,
  toIsoExclusive: string,
): Promise<
  Array<
    ContentDraft & {
      brandSlug: string;
      brandDisplayName: string;
      brandColor: string;
    }
  >
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .in("status", ["scheduled", "published"])
    .eq("brands.is_archived", false)
    .gte("scheduled_at", fromIsoInclusive)
    .lt("scheduled_at", toIsoExclusive)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(`Errore lettura calendario giorno: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    ...rowToDraft(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
}

export type ArchiveSearchInput = {
  organizationId: string;
  query?: string; // full-text
  brandId?: string;
  status?: ContentDraftStatus;
  topicLabel?: string; // RF-12.2 filtro etichetta di argomento
  fromDateIso?: string;
  toDateIso?: string;
  limit?: number;
  offset?: number;
};

/**
 * RF-12.2 Archivio + ricerca full-text cross-brand.
 * Usa ilike su theme_input + generated_text (l'index full-text tsvector e
 * predisposto in mig ma non usato: overkill per volumi F1 <10k drafts).
 * Ordinato per created_at desc. Include brand_slug/display_name/color per la UI.
 */
export async function searchArchive(input: ArchiveSearchInput): Promise<{
  items: Array<ContentDraft & { brandSlug: string; brandDisplayName: string; brandColor: string }>;
  totalCount: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("content_drafts")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`, {
      count: "exact",
    })
    .eq("organization_id", input.organizationId)
    .eq("brands.is_archived", false);

  if (input.query && input.query.trim().length > 0) {
    const term = `%${input.query.trim()}%`;
    q = q.or(`theme_input.ilike.${term},generated_text.ilike.${term}`);
  }
  if (input.brandId) q = q.eq("brand_id", input.brandId);
  if (input.status) q = q.eq("status", input.status);
  if (input.topicLabel) q = q.eq("topic_label", input.topicLabel);
  if (input.fromDateIso) q = q.gte("created_at", input.fromDateIso);
  if (input.toDateIso) q = q.lte("created_at", input.toDateIso);

  const limit = input.limit ?? 30;
  const offset = input.offset ?? 0;
  q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`Errore ricerca archivio: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((data ?? []) as any[]).map((row) => ({
    ...rowToDraft(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
  return { items, totalCount: count ?? items.length };
}

/**
 * Contatori aggregati per la Home M12 (RF-12.1). Una count per stato del pipeline
 * editoriale, tenant-scoped su organization_id. Restituisce sempre 4 numeri >= 0.
 */
export async function getContentDraftsDashboardCounts(organizationId: string): Promise<{
  draftsPending: number;
  approvedNotScheduled: number;
  scheduledUpcoming: number;
  publishedThisWeek: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const nowIso = new Date().toISOString();
  const in7dIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const from7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [draftsRes, approvedRes, scheduledRes, publishedRes] = await Promise.all([
    admin
      .from("content_drafts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "draft"),
    admin
      .from("content_drafts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .is("scheduled_at", null),
    admin
      .from("content_drafts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "scheduled")
      .gte("scheduled_at", nowIso)
      .lt("scheduled_at", in7dIso),
    admin
      .from("content_drafts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "published")
      .gte("published_at", from7dIso),
  ]);

  if (draftsRes.error) throw new Error(`Errore conteggio bozze: ${draftsRes.error.message}`);
  if (approvedRes.error)
    throw new Error(`Errore conteggio approvati: ${approvedRes.error.message}`);
  if (scheduledRes.error)
    throw new Error(`Errore conteggio programmati: ${scheduledRes.error.message}`);
  if (publishedRes.error)
    throw new Error(`Errore conteggio pubblicati: ${publishedRes.error.message}`);

  return {
    draftsPending: draftsRes.count ?? 0,
    approvedNotScheduled: approvedRes.count ?? 0,
    scheduledUpcoming: scheduledRes.count ?? 0,
    publishedThisWeek: publishedRes.count ?? 0,
  };
}

/**
 * Tenant-scoped: lista drafts in stato 'approved' e non ancora programmati (scheduled_at IS NULL).
 * Usato dal drawer laterale del calendario.
 */
export async function listApprovedNotScheduledByBrand(
  brandId: string,
  organizationId: string,
  limit: number = 50,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("brand_id", brandId)
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .is("scheduled_at", null)
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lettura approvati in attesa: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToDraft);
}
