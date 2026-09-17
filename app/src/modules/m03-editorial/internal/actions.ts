"use server";

// M03 — Server actions per generate/approve/reject content drafts.
// Ogni action: requireOwnedBrand/requireOwnedDraft (RN-87, RA-8.5) →
// validazione → orchestrazione → logAuditEvent (RF-11.3) → revalidatePath.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/log";
import { embedText } from "@/lib/ai/voyage";
import { runGenerateSocialPost } from "./generate-social-post";
import { markApproved, markRejected, isRateLimited } from "./content-drafts-repo";

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
