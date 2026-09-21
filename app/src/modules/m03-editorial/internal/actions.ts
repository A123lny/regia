"use server";

// M03 — Server actions per generate/approve/reject content drafts.
// Ogni action: requireOwnedBrand/requireOwnedDraft (RN-87, RA-8.5) →
// validazione → orchestrazione → logAuditEvent (RF-11.3) → revalidatePath.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/log";
import { embedText } from "@/lib/ai/voyage";
import {
  generateText,
  GeminiTimeoutError,
  GeminiRateLimitError,
  GeminiApiError,
  GeminiConfigError,
} from "@/lib/ai/gemini";
import { formatBrandContextForAI } from "@/modules/m02-brand/public";
import {
  composeImagePromptSystemMessage,
  composeImagePromptUserMessage,
  IMAGE_PROMPT_VERSION,
} from "./image-prompt-composer";
import { runGenerateImage } from "./generate-image";
import type { FluxModel } from "@/lib/ai/fal";
import { createHash } from "crypto";
import { runGenerateSocialPost } from "./generate-social-post";
import {
  markApproved,
  markRejected,
  isRateLimited,
  scheduleDraft,
  unscheduleDraft,
  markPublished,
  setDraftImage,
  clearDraftImage,
  getDraftImagePath,
} from "./content-drafts-repo";

async function requireOwnedBrand(brandId: string) {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") {
    throw new Error("Solo Owner può gestire i contenuti (RU-1a)");
  }
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

async function requireOwnedDraft(draftId: string) {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") {
    throw new Error("Solo Owner può gestire i contenuti (RU-1a)");
  }
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

  const { session, brand } = await requireOwnedBrand(brandId);

  // Anti-slot-machine: 10s tra un click e l'altro dello stesso Owner sullo stesso brand.
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
  const { session, draft } = await requireOwnedDraft(draftId);
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
  const { session, draft } = await requireOwnedDraft(draftId);
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
  const { session, draft } = await requireOwnedDraft(draftId);
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
  const { session, draft } = await requireOwnedDraft(draftId);
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

export async function markContentDraftPublished(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId);
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

const IMAGE_MUTABLE_STATES = ["draft", "approved", "scheduled"] as const;

function hashPromptShort(prompt: string): string {
  const full = createHash("sha256").update(prompt).digest("hex");
  return `${full.slice(0, 8)}...${full.slice(-8)}`;
}

export async function suggestImagePrompt(
  draftId: string,
): Promise<{ ok: true; prompt: string } | { ok: false; error: string }> {
  const { draft } = await requireOwnedDraft(draftId);
  if (!IMAGE_MUTABLE_STATES.includes(draft.status as (typeof IMAGE_MUTABLE_STATES)[number])) {
    return { ok: false, error: `Bozza in stato ${draft.status}, immagine non modificabile.` };
  }

  // Fetch dati draft completi (per generated_text) e brand display_name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const [draftRes, brandRes] = await Promise.all([
    admin.from("content_drafts").select("generated_text").eq("id", draftId).maybeSingle(),
    admin.from("brands").select("display_name").eq("id", draft.brand_id).maybeSingle(),
  ]);
  if (!draftRes.data) return { ok: false, error: "Bozza non trovata." };
  if (!brandRes.data) return { ok: false, error: "Brand non trovato." };

  const brandContext = await formatBrandContextForAI(draft.brand_id);

  const systemPrompt = composeImagePromptSystemMessage();
  const userMessage = composeImagePromptUserMessage({
    brandDisplayName: (brandRes.data as { display_name: string }).display_name,
    brandContext,
    postText: (draftRes.data as { generated_text: string }).generated_text,
  });

  try {
    const result = await generateText({ systemPrompt, userMessage, maxTokens: 300 });
    return { ok: true, prompt: result.text.trim() };
  } catch (err) {
    if (
      err instanceof GeminiTimeoutError ||
      err instanceof GeminiRateLimitError ||
      err instanceof GeminiApiError ||
      err instanceof GeminiConfigError
    ) {
      return { ok: false, error: `Impossibile suggerire il prompt: ${(err as Error).message}` };
    }
    throw err;
  }
}

export async function generateContentDraftImage(
  draftId: string,
  prompt: string,
  model: FluxModel = "flux-dev",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = prompt.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    return { ok: false, error: "Prompt non valido (1-2000 caratteri)" };
  }
  if (model !== "flux-dev" && model !== "flux-schnell") {
    return { ok: false, error: "Modello non valido (flux-dev o flux-schnell)" };
  }

  const { session, draft } = await requireOwnedDraft(draftId);
  if (!IMAGE_MUTABLE_STATES.includes(draft.status as (typeof IMAGE_MUTABLE_STATES)[number])) {
    return { ok: false, error: `Bozza in stato ${draft.status}, immagine non modificabile.` };
  }

  const result = await runGenerateImage({
    organizationId: session.organizationId,
    draftId,
    prompt: trimmed,
    model,
  });
  if (!result.ok) return result;

  const updated = await setDraftImage(draftId, session.organizationId, {
    url: result.imagePath,
    prompt: trimmed,
    model: result.model,
    costUsd: result.costUsd,
    generatedAt: result.generatedAt,
  });
  if (!updated) {
    return { ok: false, error: "Bozza modificata da un'altra sessione. Ricarica e riprova." };
  }

  const brandSlug = await getBrandSlug(draft.brand_id);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_image_generated",
    target: `brand:${brandSlug}`,
    details: {
      draftId,
      model: result.model,
      costUsd: result.costUsd,
      promptLength: trimmed.length,
      promptHash: hashPromptShort(trimmed),
      promptVersion: IMAGE_PROMPT_VERSION,
    },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);

  return { ok: true };
}

export async function deleteContentDraftImage(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId);
  if (!IMAGE_MUTABLE_STATES.includes(draft.status as (typeof IMAGE_MUTABLE_STATES)[number])) {
    throw new Error(`Bozza in stato ${draft.status}, immagine non modificabile.`);
  }

  const imagePath = await getDraftImagePath(draftId, session.organizationId);
  if (!imagePath) return; // no-op

  const brandSlug = await getBrandSlug(draft.brand_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = getAdminClient() as any;
  const { error: removeError } = await adminClient.storage
    .from("content-media")
    .remove([imagePath]);
  if (removeError) {
    // Best-effort: log warning ma continua a azzerare DB (per non lasciare orfano)
    console.warn(`[m03] Storage remove fallito: ${removeError.message}`);
  }

  const cleared = await clearDraftImage(draftId, session.organizationId);
  if (!cleared) {
    throw new Error("Impossibile azzerare i campi immagine del draft.");
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_image_deleted",
    target: `brand:${brandSlug}`,
    details: { draftId, deletedPath: imagePath },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);
}
