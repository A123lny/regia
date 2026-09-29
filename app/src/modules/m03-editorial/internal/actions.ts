"use server";

// M03 — Server actions per generate/approve/reject content drafts.
// Ogni action: requireOwnedBrand/requireOwnedDraft (RN-87, RA-8.5) →
// validazione → orchestrazione → logAuditEvent (RF-11.3) → revalidatePath.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { embedText } from "@/lib/ai/voyage";
import { runGenerateSocialPost } from "./generate-social-post";
import { runGenerateEditorialPlan, type PlanGenerationResult } from "./plan-generator";
import {
  runGenerateServiceCommunication,
  type RunGenerateServiceCommunicationOutput,
} from "./generate-service-communication";
import { getRecurrenceById } from "./recurring-events-repo";
import {
  assertAiEnabled,
  AiKillSwitchError,
  assertBudgetOk,
  logSpend,
  AiBudgetExceededError,
} from "@/modules/m11-admin/public";
import {
  markApproved,
  markRejected,
  isRateLimited,
  scheduleDraft,
  unscheduleDraft,
  markPublished,
  rescheduleDraft,
  deleteDraft,
} from "./content-drafts-repo";

async function requireOwnedBrand(brandId: string, cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, display_name, organization_id")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Brand non trovato");
  if (data.organization_id !== session.organizationId) {
    throw new Error("Accesso negato al brand");
  }
  return {
    session,
    brand: data as {
      id: string;
      slug: string;
      display_name: string;
      organization_id: string;
    },
  };
}

async function requireOwnedDraft(draftId: string, cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select("id, brand_id, organization_id, status")
    .eq("id", draftId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica draft: ${error.message}`);
  if (!data) throw new Error("Bozza non trovata");
  if (data.organization_id !== session.organizationId) {
    throw new Error("Accesso negato alla bozza");
  }
  return {
    session,
    draft: data as {
      id: string;
      brand_id: string;
      organization_id: string;
      status: string;
    },
  };
}

async function getBrandSlug(brandId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin.from("brands").select("slug").eq("id", brandId).maybeSingle();
  return (data?.slug as string) ?? "";
}

export async function generateSocialPost(
  brandId: string,
  formData: FormData,
): Promise<{ ok: true; draftId: string } | { ok: false; error: string }> {
  const themeInput = String(formData.get("themeInput") ?? "").trim();
  if (themeInput.length < 1 || themeInput.length > 2000) {
    return { ok: false, error: "Tema non valido (1-2000 caratteri)" };
  }

  const { session, brand } = await requireOwnedBrand(brandId, "content.generate");

  // RF-11.4: kill switch AI
  try {
    await assertAiEnabled(session.organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }

  // RF-11.5: tetti spesa
  try {
    await assertBudgetOk(session.organizationId, "anthropic");
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }

  // Anti-slot-machine: 10s tra un click e l'altro dello stesso utente sullo stesso brand.
  if (await isRateLimited(brand.id, session.userId, 10)) {
    return { ok: false, error: "Attendi qualche secondo tra una generazione e l'altra." };
  }

  const result = await runGenerateSocialPost({
    organizationId: session.organizationId,
    brandId: brand.id,
    brandSlug: brand.slug,
    brandDisplayName: brand.display_name,
    themeInput,
    userId: session.userId,
  });

  if (!result.ok) return result;

  // RF-11.5: log spesa AI
  await logSpend({
    organizationId: session.organizationId,
    brandId: brand.id,
    category: "anthropic",
    action: "editorial.social_post",
    costUsd: result.draft.costUsd,
    tokensIn: result.draft.tokensIn,
    tokensOut: result.draft.tokensOut,
    targetType: "draft",
    targetId: result.draft.id,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_generated",
    target: `brand:${brand.slug}`,
    details: {
      draftId: result.draft.id,
      channel: "social",
      tokensIn: result.draft.tokensIn,
      tokensOut: result.draft.tokensOut,
      costUsd: result.draft.costUsd,
      model: result.draft.modelUsed,
    },
  });

  revalidatePath(`/contenuti/${brand.slug}`);
  return { ok: true, draftId: result.draft.id };
}

export async function approveContentDraft(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId, "content.approve");
  if (draft.status !== "draft") {
    throw new Error(`Bozza in stato ${draft.status}, non approvabile`);
  }

  const brandSlug = await getBrandSlug(draft.brand_id);

  await markApproved(draftId);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_approved",
    target: `brand:${brandSlug}`,
    details: { draftId },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
}

export async function rejectContentDraft(draftId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new Error("Motivo del rifiuto obbligatorio (1-500 caratteri) — RF-3.8");
  }
  const { session, draft } = await requireOwnedDraft(draftId, "content.reject");
  if (draft.status !== "draft") {
    throw new Error(`Bozza in stato ${draft.status}, non rifiutabile`);
  }

  // Calcolo embedding rejection_reason. Se Voyage fallisce, salviamo la reason
  // senza embedding (retrieval semantico degradato; base RF-3.8 preservata).
  let reasonEmbedding: number[] = [];
  try {
    const emb = await embedText({ text: trimmed });
    reasonEmbedding = emb.embedding;
  } catch (err) {
    console.warn("[m03] Voyage embedding rifiuto non disponibile:", (err as Error).message);
    reasonEmbedding = [];
  }

  const brandSlug = await getBrandSlug(draft.brand_id);

  await markRejected({ draftId, reason: trimmed, reasonEmbedding });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_rejected",
    target: `brand:${brandSlug}`,
    details: {
      draftId,
      reasonLength: trimmed.length,
      hasEmbedding: reasonEmbedding.length === 512,
    },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
}

export async function scheduleContentDraft(draftId: string, scheduledAtIso: string): Promise<void> {
  // 1. Validation server-side: data parsabile + strettamente futura.
  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Data di programmazione non valida");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("La data di pubblicazione deve essere nel futuro");
  }

  // 2. Auth + ownership + status guard
  const { session, draft } = await requireOwnedDraft(draftId, "content.schedule");
  if (draft.status !== "approved") {
    throw new Error(`Bozza in stato ${draft.status}, non programmabile`);
  }

  // 3. Repo
  const brandSlug = await getBrandSlug(draft.brand_id);
  const updated = await scheduleDraft(draftId, session.organizationId, scheduledAt.toISOString());
  if (!updated) {
    // Race con concurrent unschedule/publish: la state guard .eq("status","approved") non ha matchato.
    throw new Error("Bozza modificata da un'altra sessione. Ricarica e riprova.");
  }

  // 4. Audit (RF-11.3, RA-8.12)
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_scheduled",
    target: `brand:${brandSlug}`,
    details: { draftId, scheduledAt: scheduledAt.toISOString() },
  });

  // 5. Revalidate lista + calendario
  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
}

export async function unscheduleContentDraft(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId, "content.unschedule");
  if (draft.status !== "scheduled") {
    throw new Error(`Bozza in stato ${draft.status}, non annullabile`);
  }

  const brandSlug = await getBrandSlug(draft.brand_id);
  const unscheduled = await unscheduleDraft(draftId, session.organizationId);
  if (!unscheduled) {
    // Race con concurrent publish: la state guard .eq("status","scheduled") non ha matchato.
    throw new Error("Bozza modificata da un'altra sessione. Ricarica e riprova.");
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_unscheduled",
    target: `brand:${brandSlug}`,
    details: { draftId },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
}

export type PlanGenerationActionInput = {
  brandId: string;
  numDrafts: number;
  startDateIso: string;
  excludedPillarIds: string[];
};

export async function generateEditorialPlan(
  input: PlanGenerationActionInput,
): Promise<PlanGenerationResult> {
  // 1. Validation
  if (input.numDrafts < 1 || input.numDrafts > 30) {
    return { ok: false, error: "Numero bozze fuori range (1-30)" };
  }
  const startDate = new Date(input.startDateIso);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: "Data di inizio non valida" };
  }

  // 2. Auth + ownership (usa capability content.generate come singola generazione)
  const { session, brand } = await requireOwnedBrand(input.brandId, "content.generate");

  // RF-11.4: kill switch AI
  try {
    await assertAiEnabled(session.organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }

  // RF-11.5: tetti spesa (stima grossolana: numDrafts * 0.001)
  try {
    await assertBudgetOk(session.organizationId, "anthropic", input.numDrafts * 0.001);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }

  // 3. Orchestrazione plan
  const result = await runGenerateEditorialPlan({
    organizationId: session.organizationId,
    brandId: brand.id,
    brandSlug: brand.slug,
    brandDisplayName: brand.display_name,
    userId: session.userId,
    numDrafts: input.numDrafts,
    startDateIso: input.startDateIso,
    excludedPillarIds: input.excludedPillarIds,
  });

  // 4. Audit (anche partial: tracciamo cosa e stato creato)
  if (result.ok) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "editorial.plan_generated",
      target: `brand:${brand.slug}`,
      details: {
        planBatchId: result.planBatchId,
        numDrafts: result.drafts.length,
        totalCostUsd: result.totalCostUsd,
      },
    });
    // RF-11.5: log spesa aggregata piano
    await logSpend({
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "anthropic",
      action: "editorial.plan",
      costUsd: result.totalCostUsd,
      targetType: "plan_batch",
      targetId: result.planBatchId,
    });
  } else if (result.partialBatchId) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "editorial.plan_partial",
      target: `brand:${brand.slug}`,
      details: {
        planBatchId: result.partialBatchId,
        partialCount: result.partialDrafts?.length ?? 0,
        error: result.error,
      },
    });
  }

  // 5. Revalidate
  revalidatePath(`/contenuti/${brand.slug}`);
  revalidatePath("/dashboard");
  return result;
}

/**
 * RF-3.4: genera un draft da una ricorrenza attivata dalla dashboard.
 * Usa il prompt "social-post" con theme_input = suggested_theme dell'evento,
 * e tagga theme_input come [RICORRENZA:<eventId>:<year>] cosi listUpcomingRecurrences
 * puo rilevare che e stato gia attivato quest'anno.
 */
export async function generateRecurrenceDraft(
  eventId: string,
  yearTag: string,
): Promise<{ ok: true; draftId: string; brandSlug: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const event = await getRecurrenceById(session.organizationId, eventId);
  if (!event) return { ok: false, error: "Ricorrenza non trovata" };

  // RF-11.4: kill switch AI
  try {
    await assertAiEnabled(session.organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }

  // RF-11.5: tetti spesa
  try {
    await assertBudgetOk(session.organizationId, "anthropic");
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }

  const result = await runGenerateSocialPost({
    organizationId: session.organizationId,
    brandId: event.brandId,
    brandSlug: event.brandSlug,
    brandDisplayName: event.brandDisplayName,
    themeInput: event.suggestedTheme,
    userId: session.userId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  // RF-11.5: log spesa
  await logSpend({
    organizationId: session.organizationId,
    brandId: event.brandId,
    category: "anthropic",
    action: "editorial.recurrence",
    costUsd: result.draft.costUsd,
    tokensIn: result.draft.tokensIn,
    tokensOut: result.draft.tokensOut,
    targetType: "draft",
    targetId: result.draft.id,
  });

  // Ri-tagga il theme_input per rendere l'attivazione tracciabile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const trackedTheme = `[RICORRENZA:${eventId}:${yearTag}] ${event.suggestedTheme}`;
  await admin
    .from("content_drafts")
    .update({ theme_input: trackedTheme })
    .eq("id", result.draft.id);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.recurrence_activated",
    target: `brand:${event.brandSlug}`,
    details: { eventId, eventName: event.name, yearTag, draftId: result.draft.id },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/contenuti/${event.brandSlug}`);
  return { ok: true, draftId: result.draft.id, brandSlug: event.brandSlug };
}

export async function generateServiceCommunication(
  brandId: string,
  ownerInput: string,
): Promise<RunGenerateServiceCommunicationOutput> {
  const trimmed = ownerInput.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false, error: "Comunicazione troppo corta o troppo lunga (3-500 caratteri)" };
  }

  const { session, brand } = await requireOwnedBrand(brandId, "content.generate");

  // RF-11.4: kill switch AI
  try {
    await assertAiEnabled(session.organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }

  // RF-11.5: tetti spesa
  try {
    await assertBudgetOk(session.organizationId, "anthropic");
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }

  const result = await runGenerateServiceCommunication({
    organizationId: session.organizationId,
    brandId: brand.id,
    brandSlug: brand.slug,
    brandDisplayName: brand.display_name,
    ownerInput: trimmed,
    userId: session.userId,
  });

  if (result.ok) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "editorial.service_generated",
      target: `brand:${brand.slug}`,
      details: {
        draftId: result.draft.id,
        inputLength: trimmed.length,
        costUsd: result.draft.costUsd,
      },
    });
    // RF-11.5: log spesa
    await logSpend({
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "anthropic",
      action: "editorial.service",
      costUsd: result.draft.costUsd,
      tokensIn: result.draft.tokensIn,
      tokensOut: result.draft.tokensOut,
      targetType: "draft",
      targetId: result.draft.id,
    });
    revalidatePath(`/contenuti/${brand.slug}`);
  }

  return result;
}

export async function rescheduleContentDraft(
  draftId: string,
  scheduledAtIso: string,
): Promise<void> {
  // 1. Validation server-side: data parsabile + strettamente futura.
  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Data di programmazione non valida");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("La data di pubblicazione deve essere nel futuro");
  }

  // 2. Auth + ownership + status guard (deve essere già scheduled)
  const { session, draft } = await requireOwnedDraft(draftId, "content.reschedule");
  if (draft.status !== "scheduled") {
    throw new Error(`Bozza in stato ${draft.status}, non riprogrammabile`);
  }

  // 3. Repo
  const brandSlug = await getBrandSlug(draft.brand_id);
  const updated = await rescheduleDraft(draftId, session.organizationId, scheduledAt.toISOString());
  if (!updated) {
    throw new Error("Bozza modificata da un'altra sessione. Ricarica e riprova.");
  }

  // 4. Audit
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_rescheduled",
    target: `brand:${brandSlug}`,
    details: { draftId, scheduledAt: scheduledAt.toISOString() },
  });

  // 5. Revalidate
  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
  revalidatePath("/contenuti/calendario");
  revalidatePath("/dashboard");
}

export async function deleteContentDraft(draftId: string): Promise<void> {
  // 1. Auth + ownership + guardia dominio: mai eliminare published.
  const { session, draft } = await requireOwnedDraft(draftId, "content.delete");
  if (draft.status === "published") {
    throw new Error("Le bozze pubblicate non possono essere eliminate (audit)");
  }

  // 2. Repo (guardia doppia lato DB: neq status='published').
  const brandSlug = await getBrandSlug(draft.brand_id);
  const deleted = await deleteDraft(draftId, session.organizationId);
  if (!deleted) {
    throw new Error("Bozza modificata da un'altra sessione. Ricarica e riprova.");
  }

  // 3. Audit
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_deleted",
    target: `brand:${brandSlug}`,
    details: { draftId, previousStatus: draft.status },
  });

  // 4. Revalidate
  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
  revalidatePath("/contenuti/calendario");
  revalidatePath("/contenuti");
  revalidatePath("/dashboard");
}

export async function markContentDraftPublished(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId, "content.publish");
  if (draft.status !== "scheduled") {
    throw new Error(`Bozza in stato ${draft.status}, non pubblicabile`);
  }

  const brandSlug = await getBrandSlug(draft.brand_id);
  const published = await markPublished(draftId, session.organizationId);
  if (!published) {
    // Race con concurrent unschedule: la state guard .eq("status","scheduled") non ha matchato.
    throw new Error("Bozza modificata da un'altra sessione. Ricarica e riprova.");
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_published",
    target: `brand:${brandSlug}`,
    details: { draftId, publishedAt: published.publishedAt },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
}

// RF-12.2 manual override dell'etichetta di argomento su una bozza esistente.
// Accetta solo i valori enum in TOPIC_LABELS; DB check constraint doppia guardia.
export async function updateContentDraftTopicLabel(
  draftId: string,
  newLabel: string,
): Promise<void> {
  const { TOPIC_LABELS } = await import("./topic-classifier");
  if (!(TOPIC_LABELS as readonly string[]).includes(newLabel)) {
    throw new Error(`Etichetta non valida: ${newLabel}`);
  }
  const { session, draft } = await requireOwnedDraft(draftId, "content.generate");
  const brandSlug = await getBrandSlug(draft.brand_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("content_drafts")
    .update({ topic_label: newLabel })
    .eq("id", draftId)
    .eq("organization_id", session.organizationId);
  if (error) throw new Error(`Errore aggiornamento etichetta: ${error.message}`);
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.topic_label_updated",
    target: `brand:${brandSlug}`,
    details: { draftId, newLabel },
  });
  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);
  revalidatePath("/contenuti/archivio");
}
