// M13 Advertising — RF-13.1..13.4 + 13.6.
// Tetti spesa + interruttori per (brand, categoria), classificazione draft,
// workflow sforamento mai automatico.

import { getAdminClient } from "@/lib/db/admin";

export type AdCategory = "social_sponsored" | "google_ads_search" | "google_ads_display";

export const AD_CATEGORY_LABELS: Record<AdCategory, string> = {
  social_sponsored: "Sponsorizzate social",
  google_ads_search: "Google Ads · Ricerca",
  google_ads_display: "Google Ads · Display",
};

export type AdClassification =
  "only_organic" | "boosted_within_budget" | "boost_candidate_over_budget";

export const AD_CLASSIFICATION_LABELS: Record<AdClassification, string> = {
  only_organic: "Solo organico",
  boosted_within_budget: "Spinto entro budget",
  boost_candidate_over_budget: "Candidato a spinta maggiore",
};

export type AdvertisingBudget = {
  id: string;
  organizationId: string;
  brandId: string;
  category: AdCategory;
  monthlyCapCents: number;
  enabled: boolean;
  updatedAt: string;
};

export type AdvertisingBudgetWithSpend = AdvertisingBudget & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  monthSpentCents: number; // somma ledger kind='actual' del mese corrente
  monthEstimatedCents: number; // somma ledger kind='estimated' del mese corrente
  remainingCents: number; // max(0, cap - spent - estimated)
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBudget(row: any): AdvertisingBudget {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    category: row.category as AdCategory,
    monthlyCapCents: row.monthly_cap_cents,
    enabled: row.enabled,
    updatedAt: row.updated_at,
  };
}

/**
 * Lista budget per org con brand info + somme spesa del mese (actual + estimated).
 * Se un (brand, categoria) non ha ancora riga, NON viene listato — la UI
 * mostra placeholder "non configurato" per i (brand × 3 categorie) attesi.
 */
export async function listAdvertisingBudgets(
  organizationId: string,
): Promise<AdvertisingBudgetWithSpend[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("advertising_budgets")
    .select("*, brands!inner(slug, display_name, color)")
    .eq("organization_id", organizationId);
  if (error) throw new Error(`listAdvertisingBudgets: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgets = (data ?? []) as any[];
  if (budgets.length === 0) return [];

  // Carica somme spesa mese corrente
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: ledger } = await admin
    .from("advertising_spend_ledger")
    .select("brand_id, category, kind, amount_cents")
    .eq("organization_id", organizationId)
    .gte("spent_at", monthStart.toISOString());

  type SpendKey = string;
  const spentMap = new Map<SpendKey, { actual: number; estimated: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (ledger ?? []) as any[]) {
    const key = `${r.brand_id}:${r.category}`;
    const prev = spentMap.get(key) ?? { actual: 0, estimated: 0 };
    if (r.kind === "actual") prev.actual += Number(r.amount_cents ?? 0);
    else prev.estimated += Number(r.amount_cents ?? 0);
    spentMap.set(key, prev);
  }

  return budgets.map((row): AdvertisingBudgetWithSpend => {
    const key = `${row.brand_id}:${row.category}`;
    const sp = spentMap.get(key) ?? { actual: 0, estimated: 0 };
    const remaining = Math.max(0, row.monthly_cap_cents - sp.actual - sp.estimated);
    return {
      ...rowToBudget(row),
      brandSlug: row.brands.slug as string,
      brandDisplayName: row.brands.display_name as string,
      brandColor: row.brands.color as string,
      monthSpentCents: sp.actual,
      monthEstimatedCents: sp.estimated,
      remainingCents: remaining,
    };
  });
}

export async function getAdvertisingBudget(
  organizationId: string,
  brandId: string,
  category: AdCategory,
): Promise<AdvertisingBudget | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("advertising_budgets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("category", category)
    .maybeSingle();
  if (error) throw new Error(`getAdvertisingBudget: ${error.message}`);
  return data ? rowToBudget(data) : null;
}

export type UpsertBudgetInput = {
  organizationId: string;
  brandId: string;
  category: AdCategory;
  monthlyCapCents: number;
  updatedBy: string | null;
};

/**
 * RF-13.1: upsert tetto per (brand, categoria). Non tocca il flag enabled
 * (quello passa da toggleCategoryEnabled, decisione esplicita separata).
 */
export async function upsertAdvertisingBudget(
  input: UpsertBudgetInput,
): Promise<AdvertisingBudget> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    category: input.category,
    monthly_cap_cents: input.monthlyCapCents,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from("advertising_budgets")
    .upsert(row, { onConflict: "organization_id,brand_id,category" })
    .select("*")
    .single();
  if (error) throw new Error(`upsertAdvertisingBudget: ${error.message}`);
  return rowToBudget(data);
}

/**
 * RF-13.2: toggle on/off per (brand, categoria). Qualunque transizione (incluso
 * OFF→ON) e' sempre decisione esplicita del titolare. Il DEFAULT su insert
 * iniziale e' sempre false (constraint DB).
 */
export async function toggleAdvertisingCategory(
  organizationId: string,
  brandId: string,
  category: AdCategory,
  enabled: boolean,
  updatedBy: string | null,
): Promise<AdvertisingBudget | null> {
  const existing = await getAdvertisingBudget(organizationId, brandId, category);
  if (!existing) {
    // Crea riga a cap=0 + enabled=stato richiesto. Se enabled=true senza cap, resta
    // bloccato comunque dal check "nessuna spesa su categoria disattivata o oltre cap".
    const row = await upsertAdvertisingBudget({
      organizationId,
      brandId,
      category,
      monthlyCapCents: 0,
      updatedBy,
    });
    // Setta enabled separatamente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    const { data } = await admin
      .from("advertising_budgets")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .select("*")
      .single();
    return data ? rowToBudget(data) : null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("advertising_budgets")
    .update({ enabled, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(`toggleAdvertisingCategory: ${error.message}`);
  return rowToBudget(data);
}

/**
 * RF-13.4: classifica un draft per advertising + stima spesa pre-approvazione.
 * Il DB storage e' sulla content_drafts riga (ad_classification, ad_category,
 * ad_estimated_spend_cents). Non salva ledger entry — quello avviene a
 * invio reale (v2 Ads API).
 */
export async function classifyDraftForAdvertising(input: {
  organizationId: string;
  draftId: string;
  classification: AdClassification;
  category: AdCategory | null;
  estimatedSpendCents: number | null;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    ad_classification: input.classification,
    ad_category: input.category,
    ad_estimated_spend_cents: input.estimatedSpendCents,
  };
  const { error } = await admin
    .from("content_drafts")
    .update(patch)
    .eq("id", input.draftId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(`classifyDraftForAdvertising: ${error.message}`);
}

export type OverrunRequest = {
  id: string;
  organizationId: string;
  brandId: string;
  category: AdCategory;
  draftId: string | null;
  campaignId: string | null;
  currentCapCents: number;
  requestedAmountCents: number;
  motivation: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string | null;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
};

export type OverrunRequestRow = OverrunRequest & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOverrun(row: any): OverrunRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    category: row.category as AdCategory,
    draftId: row.draft_id ?? null,
    campaignId: row.campaign_id ?? null,
    currentCapCents: row.current_cap_cents,
    requestedAmountCents: row.requested_amount_cents,
    motivation: row.motivation,
    status: row.status as OverrunRequest["status"],
    requestedBy: row.requested_by ?? null,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by ?? null,
    decidedAt: row.decided_at ?? null,
    decisionNotes: row.decision_notes ?? null,
  };
}

export async function listOverrunRequests(
  organizationId: string,
  statusFilter?: OverrunRequest["status"],
): Promise<OverrunRequestRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("advertising_overrun_requests")
    .select("*, brands!inner(slug, display_name, color)")
    .eq("organization_id", organizationId);
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data, error } = await q.order("requested_at", { ascending: false });
  if (error) throw new Error(`listOverrunRequests: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    ...rowToOverrun(r),
    brandSlug: r.brands.slug as string,
    brandDisplayName: r.brands.display_name as string,
    brandColor: r.brands.color as string,
  }));
}

export type CreateOverrunInput = {
  organizationId: string;
  brandId: string;
  category: AdCategory;
  draftId?: string | null;
  campaignId?: string | null;
  requestedAmountCents: number;
  motivation: string;
  requestedBy: string | null;
};

export async function createOverrunRequest(input: CreateOverrunInput): Promise<OverrunRequest> {
  if (input.motivation.trim().length < 20) {
    throw new Error(
      "Motivazione troppo corta (minimo 20 caratteri) — RF-13.6 richiede motivazione concreta",
    );
  }
  const existing = await getAdvertisingBudget(input.organizationId, input.brandId, input.category);
  const currentCap = existing?.monthlyCapCents ?? 0;
  if (input.requestedAmountCents <= currentCap) {
    throw new Error(
      `Importo richiesto (${input.requestedAmountCents}c) non supera il tetto corrente (${currentCap}c): aumenta direttamente il budget invece di aprire una richiesta sforamento`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    category: input.category,
    draft_id: input.draftId ?? null,
    campaign_id: input.campaignId ?? null,
    current_cap_cents: currentCap,
    requested_amount_cents: input.requestedAmountCents,
    motivation: input.motivation.trim(),
    requested_by: input.requestedBy,
  };
  const { data, error } = await admin
    .from("advertising_overrun_requests")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`createOverrunRequest: ${error.message}`);
  return rowToOverrun(data);
}

/**
 * RF-13.6: Owner approva/rifiuta. Se approvato, aumentiamo automaticamente
 * il tetto a requested_amount (nessuna doppia azione: il titolare ha deciso).
 */
export async function decideOverrunRequest(input: {
  organizationId: string;
  requestId: string;
  decision: "approved" | "rejected";
  decidedBy: string | null;
  notes?: string;
}): Promise<OverrunRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Carica richiesta per controlli
  const { data: req, error: readErr } = await admin
    .from("advertising_overrun_requests")
    .select("*")
    .eq("id", input.requestId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (readErr) throw new Error(`decideOverrunRequest read: ${readErr.message}`);
  if (!req) throw new Error("Richiesta non trovata");
  if (req.status !== "pending") throw new Error(`Richiesta gia' ${req.status}, non modificabile`);

  const patch: Record<string, unknown> = {
    status: input.decision,
    decided_by: input.decidedBy,
    decided_at: new Date().toISOString(),
    decision_notes: input.notes ?? null,
  };
  const { data: updated, error: updErr } = await admin
    .from("advertising_overrun_requests")
    .update(patch)
    .eq("id", input.requestId)
    .eq("status", "pending") // guardia race
    .select("*")
    .single();
  if (updErr) throw new Error(`decideOverrunRequest update: ${updErr.message}`);

  // Se approvato, alza il tetto automaticamente al valore richiesto.
  if (input.decision === "approved") {
    await upsertAdvertisingBudget({
      organizationId: input.organizationId,
      brandId: req.brand_id,
      category: req.category,
      monthlyCapCents: req.requested_amount_cents,
      updatedBy: input.decidedBy,
    });
  }

  return rowToOverrun(updated);
}
