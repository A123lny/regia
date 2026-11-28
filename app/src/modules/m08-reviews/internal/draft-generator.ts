// Draft generator per risposte recensioni (guard RF-8.7).
// Usa Gemini come gli altri testi della piattaforma (Anthropic non e'
// configurato in produzione: evitiamo la dipendenza).
// Serious → mai bozza (RF-8.4). Retry max 2 su fail/guard, poi pending.

import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById, getBrandKitWithLists } from "@/modules/m02-brand/public";
// Errori sono dichiarati in anthropic.ts ma condivisi (il wrapper Gemini
// lancia le stesse classi) — cosi' la gestione errori qui è identica a m03.
import { AiTimeoutError, AiRateLimitError, AiApiError, AiConfigError } from "@/lib/ai/anthropic";
import { generateText } from "@/lib/ai/gemini";
import { buildReplyPrompt, type BrandContext } from "./prompt-builder";
import { validateDraft } from "./draft-guard";
import { getReview, updateReviewDraft } from "./reviews-repo";

const MAX_RETRIES = 2;

export type DraftGenResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      kind: "config" | "rate_limit" | "timeout" | "api" | "guard" | "unexpected";
    };

/**
 * Genera e salva la bozza di risposta. Ritorna un result object così il caller
 * può mostrare un errore specifico all'utente invece di lasciare la review
 * in pending con la UI che pulsa "Bozza in generazione…" per sempre.
 */
export async function generateDraftForReview(
  organizationId: string,
  reviewId: string,
): Promise<DraftGenResult> {
  const review = await getReview(organizationId, reviewId);
  if (!review) return { ok: false, error: `Recensione non trovata.`, kind: "unexpected" };
  if (review.classification === "serious") {
    return {
      ok: false,
      error: "Review classificata 'serious': niente bozza AI (RF-8.4).",
      kind: "unexpected",
    };
  }

  const brand = await getBrandById(organizationId, review.brandId);
  if (!brand) return { ok: false, error: `Marchio non trovato.`, kind: "unexpected" };
  const kit = await getBrandKitWithLists(review.brandId);

  const brandCtx: BrandContext = {
    slug: brand.slug,
    name: brand.displayName,
    toneOfVoice: kit?.kit.toneOfVoice ?? null,
    pillars: kit?.pillars.map((p) => p.name) ?? [],
  };

  const { system, user } = buildReplyPrompt(review, brandCtx);

  let lastGuardReason: string | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const result = await generateText({
        systemPrompt: system,
        userMessage: user,
        maxTokens: 400,
      });
      const draft = result.text;
      const guard = validateDraft(draft, brandCtx);
      if (guard.ok) {
        await updateReviewDraft(organizationId, reviewId, draft.trim(), "draft_ready");
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_generated",
          target: `review:${reviewId}`,
          details: {
            attempt,
            length: draft.trim().length,
            model: result.model,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
          },
        });
        return { ok: true };
      }
      lastGuardReason = guard.reason;
      if (attempt > MAX_RETRIES) {
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_rejected",
          target: `review:${reviewId}`,
          details: { reason: guard.reason, finalAttempt: attempt },
        });
        await updateReviewDraft(organizationId, reviewId, null, "pending");
        return {
          ok: false,
          error: `Bozza generata ma non conforme (guard: ${guard.reason}). Riprova o rispondi a mano.`,
          kind: "guard",
        };
      }
    } catch (e) {
      const isConfig = e instanceof AiConfigError;
      const isRate = e instanceof AiRateLimitError;
      const isTimeout = e instanceof AiTimeoutError;
      const isApi = e instanceof AiApiError;
      const isTransientAi = isTimeout || isRate || isApi;
      // Config error = fatale, non ritentare.
      if (isConfig) {
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_error",
          target: `review:${reviewId}`,
          details: { message: e instanceof Error ? e.message : String(e), kind: "config" },
        });
        await updateReviewDraft(organizationId, reviewId, null, "pending");
        return {
          ok: false,
          error:
            "Chiave Gemini non impostata o non valida (GEMINI_API_KEY). Chiedi all'Owner di configurarla su Vercel.",
          kind: "config",
        };
      }
      // Non-AI error = fatale (es. DB).
      if (!isTransientAi) {
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_error",
          target: `review:${reviewId}`,
          details: { message: e instanceof Error ? e.message : String(e), kind: "unexpected" },
        });
        await updateReviewDraft(organizationId, reviewId, null, "pending");
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          kind: "unexpected",
        };
      }
      // Transient AI error: ritenta se c'è ancora budget attempt.
      if (attempt > MAX_RETRIES) {
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_error",
          target: `review:${reviewId}`,
          details: {
            message: e instanceof Error ? e.message : String(e),
            kind: isRate ? "rate_limit" : isTimeout ? "timeout" : "api",
          },
        });
        await updateReviewDraft(organizationId, reviewId, null, "pending");
        return {
          ok: false,
          error: isRate
            ? "Rate limit Gemini: riprova fra 30-60 secondi."
            : isTimeout
              ? "Timeout Gemini: riprova."
              : `Errore Gemini: ${e instanceof Error ? e.message : String(e)}`,
          kind: isRate ? "rate_limit" : isTimeout ? "timeout" : "api",
        };
      }
    }
  }
  // Loop finito senza return (non dovrebbe succedere): fail generico.
  return {
    ok: false,
    error: `Generazione fallita dopo ${MAX_RETRIES + 1} tentativi${lastGuardReason ? ` (ultimo: ${lastGuardReason})` : ""}.`,
    kind: "unexpected",
  };
}
