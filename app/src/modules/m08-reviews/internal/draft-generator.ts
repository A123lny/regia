// RF-8.2/8.3 Draft generator con AI Anthropic + guard RF-8.7.
// Riuso RS-2 unico punto AI testuale (@/lib/ai/anthropic).
// Serious → mai bozza (RF-8.4). Retry max 2 su fail/guard, poi pending.

import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById, getBrandKitWithLists } from "@/modules/m02-brand/public";
import {
  generateText,
  AiTimeoutError,
  AiRateLimitError,
  AiApiError,
  AiConfigError,
} from "@/lib/ai/anthropic";
import { buildReplyPrompt, type BrandContext } from "./prompt-builder";
import { validateDraft } from "./draft-guard";
import { getReview, updateReviewDraft } from "./reviews-repo";

const MAX_RETRIES = 2;

export async function generateDraftForReview(
  organizationId: string,
  reviewId: string,
): Promise<void> {
  const review = await getReview(organizationId, reviewId);
  if (!review) throw new Error(`review ${reviewId} non trovata`);
  if (review.classification === "serious") {
    throw new Error("RF-8.4: niente bozza per review classificata 'serious'");
  }

  const brand = await getBrandById(organizationId, review.brandId);
  if (!brand) throw new Error(`brand ${review.brandId} non trovato`);
  const kit = await getBrandKitWithLists(review.brandId);

  const brandCtx: BrandContext = {
    slug: brand.slug,
    name: brand.displayName,
    toneOfVoice: kit?.kit.toneOfVoice ?? null,
    pillars: kit?.pillars.map((p) => p.name) ?? [],
  };

  const { system, user } = buildReplyPrompt(review, brandCtx);

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const result = await generateText({
        systemPrompt: system,
        userMessage: user,
        maxTokens: 400,
        temperature: 0.6,
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
        return;
      }
      if (attempt > MAX_RETRIES) {
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_rejected",
          target: `review:${reviewId}`,
          details: {
            reason: guard.reason,
            finalAttempt: attempt,
          },
        });
        await updateReviewDraft(organizationId, reviewId, null, "pending");
        return;
      }
    } catch (e) {
      // AiConfigError = fatale (API key assente). Non ritentare: fail fast.
      // Altri AiError = transient (timeout/rate/api) → ritenta fino a MAX_RETRIES.
      const isTransientAiError =
        e instanceof AiTimeoutError || e instanceof AiRateLimitError || e instanceof AiApiError;
      const isFatalConfig = e instanceof AiConfigError;
      if (attempt > MAX_RETRIES || !isTransientAiError || isFatalConfig) {
        await logAuditEvent({
          organizationId,
          actorUserId: null,
          actorKind: "agent",
          action: "reviews.draft_error",
          target: `review:${reviewId}`,
          details: {
            message: e instanceof Error ? e.message : String(e),
            kind: isTransientAiError || isFatalConfig ? (e as { kind?: string }).kind : "unexpected",
          },
        });
        await updateReviewDraft(organizationId, reviewId, null, "pending");
        return;
      }
    }
  }
}
