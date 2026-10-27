"use server";

import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  approveReview,
  markReviewPublished,
  resolveSerious,
  reopenSeriousForDraft,
  updateReviewDraft,
} from "./reviews-repo";
import { generateDraftForReview } from "./draft-generator";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

export async function approveReviewAction(input: {
  reviewId: string;
  approvedReply: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuth("reviews.respond");
    const text = input.approvedReply.trim();
    if (text.length === 0 || text.length > 500) {
      return { ok: false, error: "Lunghezza risposta non valida (1-500)" };
    }
    await approveReview(session.organizationId, input.reviewId, text, session.userId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reviews.approved",
      target: `review:${input.reviewId}`,
      details: { length: text.length },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markReviewPublishedAction(input: {
  reviewId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuth("reviews.respond");
    await markReviewPublished(session.organizationId, input.reviewId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reviews.published",
      target: `review:${input.reviewId}`,
      details: {},
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resolveSeriousAction(input: {
  reviewId: string;
  resolvedNotes: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuth("reviews.respond");
    await resolveSerious(session.organizationId, input.reviewId, input.resolvedNotes);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reviews.serious_resolved",
      target: `review:${input.reviewId}`,
      details: { notesLength: input.resolvedNotes.trim().length },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function reopenSeriousForDraftAction(input: {
  reviewId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuth("reviews.respond");
    await reopenSeriousForDraft(session.organizationId, input.reviewId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reviews.serious_reopened_for_draft",
      target: `review:${input.reviewId}`,
      details: {},
    });
    void generateDraftForReview(session.organizationId, input.reviewId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function regenerateDraftAction(input: {
  reviewId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAuth("reviews.respond");
    await updateReviewDraft(session.organizationId, input.reviewId, null, "pending");
    await generateDraftForReview(session.organizationId, input.reviewId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reviews.draft_regenerated",
      target: `review:${input.reviewId}`,
      details: {},
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
