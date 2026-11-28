"use server";

// Server actions "Genera con AI" (fal.ai).
// Due step:
//  1) generateAiPreviews(draftId): 2–4 miniature con modello veloce (schnell)
//  2) selectAiVariant(draftId, previewUrl): rigenera a qualità (flux-pro),
//     salva nel bucket come brand_media_asset e aggancia alla bozza.
//
// Preflight obbligatori: capability, kill switch AI, budget cap, provider
// media 'fal-ai' attivo con allowed_uses=['commercial'].

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { assertAiEnabled, AiKillSwitchError } from "@/modules/m11-admin/public";
import { assertBudgetOk, AiBudgetExceededError, logSpend } from "@/modules/m11-admin/public";
import { getContentDraft } from "@/modules/m03-editorial/public";
import { getBrandById } from "@/modules/m02-brand/public";
import {
  FAL_COST_USD,
  FAL_PREVIEW_COUNT,
  FAL_PREVIEW_MODEL,
  FAL_PROVIDER_SLUG,
  FAL_QUALITY_MODEL,
  FAL_SIZE_BY_CHANNEL,
  type DraftChannelHint,
} from "@/lib/ai/fal-config";
import {
  FalApiError,
  FalConfigError,
  FalContentRejectedError,
  FalError,
  FalRateLimitError,
  FalTimeoutError,
  isFalKeyPresent,
} from "@/lib/ai/fal";
import { getActiveProviderBySlug } from "./media-providers-repo";
import { composePromptFromDraft, runFalGeneration, saveFalImageToBucket } from "./fal-generator";
import { setDraftMediaAsset } from "./media-assets-repo";
import type { MediaAsset } from "./media-assets-types";

// ────────────────────────────────────────────────────────────────────────
// Risultati pubblici
// ────────────────────────────────────────────────────────────────────────

export type AiPreviewItem = {
  // URL temporaneo fornito da fal (scade in ~1h). Il client lo mostra come
  // img src. Alla scelta, selectAiVariant rigenera a qualità (non salva le
  // anteprime non scelte).
  url: string;
  width: number;
  height: number;
};

export type AiPreviewsResult =
  | {
      ok: true;
      items: AiPreviewItem[];
      prompt: string;
      channel: DraftChannelHint;
      costUsd: number;
    }
  | { ok: false; error: string };

export type AiVariantSavedResult = { ok: true; asset: MediaAsset } | { ok: false; error: string };

// ────────────────────────────────────────────────────────────────────────
// Helper preflight: kill switch + budget + provider attivo
// ────────────────────────────────────────────────────────────────────────

function mapFalError(err: unknown): string {
  if (err instanceof FalConfigError) return err.message;
  if (err instanceof FalRateLimitError) return err.message;
  if (err instanceof FalContentRejectedError) return err.message;
  if (err instanceof FalTimeoutError) return err.message;
  if (err instanceof FalApiError) return err.message;
  if (err instanceof AiKillSwitchError) return err.message;
  if (err instanceof AiBudgetExceededError) return err.message;
  if (err instanceof Error) return err.message;
  return "Errore sconosciuto nella generazione immagine.";
}

async function preflight(
  organizationId: string,
  estimatedCostUsd: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Check FAL_KEY PRIMA di tutto: senza chiave non c'è nessuna integrazione,
  // il messaggio deve essere chiaro invece che guidare verso Provider media.
  if (!isFalKeyPresent()) {
    return {
      ok: false,
      error:
        "Chiave fal.ai non impostata. Chiedi all'amministratore di configurare FAL_KEY nelle variabili d'ambiente (Impostazioni → /impostazioni).",
    };
  }
  try {
    await assertAiEnabled(organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }
  try {
    await assertBudgetOk(organizationId, "fal", estimatedCostUsd);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }
  const provider = await getActiveProviderBySlug(organizationId, FAL_PROVIDER_SLUG);
  if (!provider) {
    return {
      ok: false,
      error:
        "Provider fal.ai non attivo. Attivalo in Impostazioni → Provider media (/impostazioni/provider-media) con uso 'Commerciale'.",
    };
  }
  if (!provider.allowedUses.includes("commercial")) {
    return {
      ok: false,
      error:
        "Il provider fal.ai non ha 'Commerciale' tra gli usi consentiti. Aggiornalo in /impostazioni/provider-media.",
    };
  }
  return { ok: true };
}

/**
 * Registra una spesa fal in modo best-effort: se il log fallisce (es. DB
 * momentaneamente irraggiungibile), la generazione comunque va a buon fine
 * ma NON silenziamo l'errore: lo scriviamo a log server così l'Owner può
 * ricostruire la spesa reale dal pannello fal.ai in caso di inconsistenza.
 */
async function logSpendBestEffort(
  input: Parameters<typeof logSpend>[0],
  ctx: { draftId: string; phase: string },
): Promise<void> {
  try {
    await logSpend(input);
  } catch (err) {
    console.error("[fal] logSpend fallito — spesa reale potrebbe non essere tracciata", {
      ...ctx,
      costUsd: input.costUsd,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Costo cumulativo addebitato tra i retry prima dell'errore finale.
 * Base class FalError espone `possiblyCharged` + `estimatedCostUsd` per tutti
 * i sottotipi (timeout, 5xx post-accettazione, empty response, content
 * rejected post-process con NSFW, rate limit dopo retry 5xx).
 */
function possiblyChargedCost(err: unknown): number {
  if (err instanceof FalError && err.possiblyCharged) return err.estimatedCostUsd;
  return 0;
}

// ────────────────────────────────────────────────────────────────────────
// Azione 1: genera anteprime (modello veloce)
// ────────────────────────────────────────────────────────────────────────

export async function generateAiPreviews(input: {
  draftId: string;
  channel?: DraftChannelHint;
}): Promise<AiPreviewsResult> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const draft = await getContentDraft(input.draftId, session.organizationId);
  if (!draft) return { ok: false, error: "Bozza non trovata." };
  const brand = await getBrandById(session.organizationId, draft.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  const channel: DraftChannelHint = input.channel ?? "instagram_post";
  // Preflight copre il worst case: 3 tentativi * N immagini. Se l'utente ha
  // cap stretto (quasi esaurito), fermiamoci prima invece che addebitare N
  // retry possibilmente 5xx-5xx-5xx. Costa poco essere pessimisti qui.
  const MAX_ATTEMPTS = 3;
  const estimatedCost = FAL_COST_USD[FAL_PREVIEW_MODEL] * FAL_PREVIEW_COUNT * MAX_ATTEMPTS;

  const pre = await preflight(session.organizationId, estimatedCost);
  if (!pre.ok) return pre;

  const { prompt, size } = await composePromptFromDraft({
    organizationId: session.organizationId,
    brandId: brand.id,
    draftThemeInput: draft.themeInput,
    draftGeneratedText: draft.generatedText,
    channel,
  });

  let result: Awaited<ReturnType<typeof runFalGeneration>>;
  try {
    result = await runFalGeneration({
      modelId: FAL_PREVIEW_MODEL,
      prompt,
      size,
      numImages: FAL_PREVIEW_COUNT,
    });
  } catch (err) {
    console.error("[fal] generateAiPreviews failed", {
      draftId: input.draftId,
      brandSlug: brand.slug,
      err: err instanceof Error ? err.message : String(err),
    });
    // Sibling-path parity: su timeout o 5xx post-accettazione, fal potrebbe
    // aver addebitato comunque. Logghiamo lo spent stimato per non lasciare
    // buco nello spend-cap.
    const chargedCost = possiblyChargedCost(err);
    if (chargedCost > 0) {
      await logSpendBestEffort(
        {
          organizationId: session.organizationId,
          brandId: brand.id,
          category: "fal",
          action: "media.ai_previews_errored_possibly_charged",
          costUsd: chargedCost,
          tokensIn: 0,
          tokensOut: 0,
          targetType: "draft",
          targetId: input.draftId,
        },
        { draftId: input.draftId, phase: "previews-error" },
      );
    }
    return { ok: false, error: mapFalError(err) };
  }

  // Log spesa + audit SUBITO dopo il round-trip fal: anche se l'anteprima è
  // stata rifiutata o il caller aborta, fal ha comunque consumato credito.
  // Best-effort: se il DB fallisce, non blocchiamo l'utente ma scriviamo a log.
  await logSpendBestEffort(
    {
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "fal",
      action: "media.ai_previews_generated",
      costUsd: result.estimatedCostUsd,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "draft",
      targetId: input.draftId,
    },
    { draftId: input.draftId, phase: "previews" },
  );
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.ai_previews_generated",
    target: `draft:${input.draftId}`,
    details: {
      provider: "fal.ai",
      model: FAL_PREVIEW_MODEL,
      channel,
      count: result.images.length,
      costUsd: result.estimatedCostUsd,
      latencyMs: result.latencyMs,
    },
  });

  return {
    ok: true,
    items: result.images.map((im) => ({ url: im.url, width: im.width, height: im.height })),
    prompt,
    channel,
    costUsd: result.estimatedCostUsd,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Azione 2: variante finale (modello di qualità) → bucket + attach
// ────────────────────────────────────────────────────────────────────────

export async function generateAndSaveAiVariant(input: {
  draftId: string;
  prompt: string;
  channel: DraftChannelHint;
  // Seed della variante preferita (opzionale): se fal lo onora, l'immagine
  // finale sarà coerente con la miniatura scelta. Al primo giro lo omettiamo.
  seed?: number;
}): Promise<AiVariantSavedResult> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const draft = await getContentDraft(input.draftId, session.organizationId);
  if (!draft) return { ok: false, error: "Bozza non trovata." };
  const brand = await getBrandById(session.organizationId, draft.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  // Preflight worst case: 3 tentativi (vedi nota su generateAiPreviews).
  const estimatedCost = FAL_COST_USD[FAL_QUALITY_MODEL] * 3;
  const pre = await preflight(session.organizationId, estimatedCost);
  if (!pre.ok) return pre;

  // generateAndSaveAiVariant riceve GIÀ il prompt (quello della preview
  // che l'utente ha scelto). Non serve ricomporlo da zero - sarebbe una
  // chiamata Gemini sprecata ad ogni "usa questa variante" per ottenere
  // un dato (size) derivabile deterministicamente dal canale.
  const size = FAL_SIZE_BY_CHANNEL[input.channel];

  // Step A: chiamata fal. Se arriva qui, fal ha già fatto il lavoro (e
  // addebitato). Da qui in poi dobbiamo loggare la spesa anche se il
  // salvataggio nel bucket fallisce.
  let result: Awaited<ReturnType<typeof runFalGeneration>>;
  try {
    result = await runFalGeneration({
      modelId: FAL_QUALITY_MODEL,
      prompt: input.prompt.slice(0, 2000),
      size,
      numImages: 1,
    });
  } catch (err) {
    console.error("[fal] generateAndSaveAiVariant: fal call failed", {
      draftId: input.draftId,
      brandSlug: brand.slug,
      err: err instanceof Error ? err.message : String(err),
    });
    // Stesso pattern di generateAiPreviews: loggo lo spent su timeout/5xx post-call.
    const chargedCost = possiblyChargedCost(err);
    if (chargedCost > 0) {
      await logSpendBestEffort(
        {
          organizationId: session.organizationId,
          brandId: brand.id,
          category: "fal",
          action: "media.ai_variant_errored_possibly_charged",
          costUsd: chargedCost,
          tokensIn: 0,
          tokensOut: 0,
          targetType: "draft",
          targetId: input.draftId,
        },
        { draftId: input.draftId, phase: "variant-error" },
      );
    }
    return { ok: false, error: mapFalError(err) };
  }

  const image = result.images[0];
  // Log spesa SUBITO: la call è andata a buon fine, fal ha addebitato.
  // Facciamolo prima di scaricare l'immagine, caricarla nel bucket, attaccarla
  // alla bozza: se qualsiasi di quei passi fallisce, la spesa è comunque
  // registrata e non c'è spend-cap bypass.
  await logSpendBestEffort(
    {
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "fal",
      action: "media.ai_variant_generated",
      costUsd: result.estimatedCostUsd,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "draft",
      targetId: input.draftId,
    },
    { draftId: input.draftId, phase: "variant-generated" },
  );

  if (!image) {
    return { ok: false, error: "fal.ai non ha restituito l'immagine finale. Riprova." };
  }

  // Step B: salvataggio in bucket + attach. Se fallisce, la spesa è già
  // registrata ma l'asset no.
  let asset;
  try {
    asset = await saveFalImageToBucket({
      imageUrl: image.url,
      organizationId: session.organizationId,
      brandId: brand.id,
      caption: `[AI] ${draft.themeInput.slice(0, 120)}`,
      tags: ["ai-generated", "fal-ai", FAL_QUALITY_MODEL.split("/").pop() ?? "flux"],
      uploadedBy: session.userId,
      contentType: image.contentType,
    });
    await setDraftMediaAsset(session.organizationId, input.draftId, asset.id);
  } catch (err) {
    console.error("[fal] generateAndSaveAiVariant: save/attach failed (fal already charged)", {
      draftId: input.draftId,
      brandSlug: brand.slug,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: mapFalError(err) };
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.ai_variant_saved",
    target: `draft:${input.draftId}`,
    details: {
      provider: "fal.ai",
      model: FAL_QUALITY_MODEL,
      channel: input.channel,
      assetId: asset.id,
      costUsd: result.estimatedCostUsd,
      latencyMs: result.latencyMs,
    },
  });

  revalidatePath(`/contenuti/${brand.slug}/${input.draftId}`);
  revalidatePath(`/marchi/${brand.slug}/media`);
  return { ok: true, asset };
}

// ────────────────────────────────────────────────────────────────────────
// "Modifica foto" - FLUX.1 Kontext (image-editing).
// Prende un'immagine esistente dalla Libreria + istruzioni testuali in
// inglese e produce una nuova immagine modificata (es. "replace background
// with cozy restaurant interior"). Costa ~$0.04 per immagine.
// Salva il risultato come NUOVO asset (non sostituisce l'originale).
// ────────────────────────────────────────────────────────────────────────

const FLUX_KONTEXT_MODEL = "fal-ai/flux-pro/kontext";
const FLUX_KONTEXT_COST_USD = 0.04;

export type EditImageResult = { ok: true; asset: MediaAsset } | { ok: false; error: string };

export async function editMediaAssetWithKontextAction(input: {
  assetId: string;
  editPrompt: string;
}): Promise<EditImageResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  const prompt = input.editPrompt.trim();
  if (prompt.length < 3 || prompt.length > 1000) {
    return { ok: false, error: "Istruzione di modifica non valida (3-1000 caratteri)." };
  }

  const { getMediaAssetById } = await import("./media-assets-repo");
  const asset = await getMediaAssetById(session.organizationId, input.assetId);
  if (!asset) return { ok: false, error: "Immagine non trovata." };

  const pre = await preflight(session.organizationId, FLUX_KONTEXT_COST_USD);
  if (!pre.ok) return pre;

  // FLUX Kontext accetta qualsiasi URL raggiungibile come image_url. L'asset
  // ha già un signed URL valido (24h) dal bucket content-media.
  const { fal } = await import("@fal-ai/client");
  type KontextOutput = {
    images?: Array<{ url?: string; width?: number; height?: number; content_type?: string }>;
    has_nsfw_concepts?: boolean[];
  };
  let out: KontextOutput;
  try {
    const result = await Promise.race([
      fal.subscribe(FLUX_KONTEXT_MODEL, {
        input: { prompt, image_url: asset.signedUrl },
        logs: false,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("fal timeout")), 90_000)),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out = ((result as any)?.data ?? result) as KontextOutput;
  } catch (err) {
    console.error("[fal] FLUX Kontext edit failed", {
      assetId: asset.id,
      err: err instanceof Error ? err.message : String(err),
    });
    // Possibly charged se fal ha accettato la richiesta: timeout e 5xx post-acceptance.
    await logSpendBestEffort(
      {
        organizationId: session.organizationId,
        brandId: asset.brandId,
        category: "fal",
        action: "media.kontext_edit_errored_possibly_charged",
        costUsd: FLUX_KONTEXT_COST_USD,
        tokensIn: 0,
        tokensOut: 0,
        targetType: "brand",
        targetId: asset.brandId,
      },
      { draftId: "-", phase: "kontext-edit-error" },
    );
    return {
      ok: false,
      error: `Modifica foto fallita: ${err instanceof Error ? err.message : "errore"}`,
    };
  }
  const imageUrl = out.images?.[0]?.url;
  if (!imageUrl) {
    await logSpendBestEffort(
      {
        organizationId: session.organizationId,
        brandId: asset.brandId,
        category: "fal",
        action: "media.kontext_edit_empty_charged",
        costUsd: FLUX_KONTEXT_COST_USD,
        tokensIn: 0,
        tokensOut: 0,
        targetType: "brand",
        targetId: asset.brandId,
      },
      { draftId: "-", phase: "kontext-edit-empty" },
    );
    const nsfw = (out.has_nsfw_concepts ?? []).some(Boolean);
    return {
      ok: false,
      error: nsfw
        ? "Modifica rifiutata dai filtri di sicurezza fal.ai. Prova con un prompt diverso."
        : "fal.ai non ha restituito l'immagine modificata.",
    };
  }

  // Logga la spesa PRIMA dell'upload (sibling-path parity): fal ha gia addebitato.
  await logSpendBestEffort(
    {
      organizationId: session.organizationId,
      brandId: asset.brandId,
      category: "fal",
      action: "media.kontext_edit_saved",
      costUsd: FLUX_KONTEXT_COST_USD,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "brand",
      targetId: asset.brandId,
    },
    { draftId: "-", phase: "kontext-edit-ok" },
  );

  let newAsset: MediaAsset;
  try {
    newAsset = await saveFalImageToBucket({
      imageUrl,
      organizationId: session.organizationId,
      brandId: asset.brandId,
      caption: `[FLUX Kontext] ${prompt.slice(0, 100)}`,
      tags: [...asset.tags, "ai-edited"].slice(0, 20),
      uploadedBy: session.userId,
      contentType: out.images?.[0]?.content_type ?? "image/jpeg",
    });
  } catch (err) {
    console.error("[fal] Kontext: save to bucket failed (fal already charged)", {
      assetId: asset.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: `Modifica generata ma non salvata: ${err instanceof Error ? err.message : "errore"}`,
    };
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.kontext_edit_saved",
    target: `media:${newAsset.id}`,
    details: {
      sourceAssetId: asset.id,
      brandId: asset.brandId,
      promptLen: prompt.length,
      costUsd: FLUX_KONTEXT_COST_USD,
    },
  });

  return { ok: true, asset: newAsset };
}
