"use server";

// M13 — server actions per aggiornare regole autonomia e flag discount_forbidden.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { updateAutonomyLevel, setProductDiscountForbidden } from "./autonomy-repo";
import type { AutonomyLevel } from "./governance-types";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

export async function updateAutonomyRuleAction(input: {
  kind: string;
  level: AutonomyLevel;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("governance.crud");
  try {
    const rule = await updateAutonomyLevel(
      session.organizationId,
      input.kind,
      input.level,
      session.userId,
    );
    if (!rule) return { ok: false, error: "Regola non trovata" };

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "governance.autonomy_level_updated",
      target: `rule:${input.kind}`,
      details: { newLevel: input.level, enforcedInCode: rule.enforcedInCode },
    });

    revalidatePath("/governance");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleProductDiscountForbiddenAction(input: {
  productId: string;
  forbidden: boolean;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("governance.crud");
  if (input.forbidden && (!input.reason || input.reason.trim().length === 0)) {
    return { ok: false, error: "Attivando il blocco serve un motivo" };
  }
  try {
    await setProductDiscountForbidden(
      input.productId,
      session.organizationId,
      input.forbidden,
      input.forbidden ? (input.reason ?? "").trim() : null,
    );
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.forbidden
        ? "governance.product_discount_locked"
        : "governance.product_discount_unlocked",
      target: `product:${input.productId}`,
      details: { reason: input.forbidden ? input.reason : null },
    });
    revalidatePath("/governance");
    revalidatePath("/catalogo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RF-13.x Advertising (motore promo con tetti spesa)
// ============================================================================

import {
  upsertAdvertisingBudget,
  toggleAdvertisingCategory,
  classifyDraftForAdvertising,
  createOverrunRequest,
  decideOverrunRequest,
  type AdCategory,
  type AdClassification,
} from "./advertising-repo";

export async function upsertAdvertisingBudgetAction(input: {
  brandId: string;
  category: AdCategory;
  monthlyCapCents: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.budgets.manage");
  if (input.monthlyCapCents < 0) {
    return { ok: false, error: "Tetto non puo' essere negativo" };
  }
  try {
    await upsertAdvertisingBudget({
      organizationId: session.organizationId,
      brandId: input.brandId,
      category: input.category,
      monthlyCapCents: input.monthlyCapCents,
      updatedBy: session.userId,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "advertising.budget_updated",
      target: `brand:${input.brandId}:${input.category}`,
      details: { monthlyCapCents: input.monthlyCapCents },
    });
    revalidatePath("/governance/advertising");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleAdvertisingCategoryAction(input: {
  brandId: string;
  category: AdCategory;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.toggle");
  try {
    await toggleAdvertisingCategory(
      session.organizationId,
      input.brandId,
      input.category,
      input.enabled,
      session.userId,
    );
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.enabled ? "advertising.category_enabled" : "advertising.category_disabled",
      target: `brand:${input.brandId}:${input.category}`,
    });
    revalidatePath("/governance/advertising");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function classifyDraftForAdvertisingAction(input: {
  draftId: string;
  classification: AdClassification;
  category: AdCategory | null;
  estimatedSpendCents: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.classify");
  try {
    await classifyDraftForAdvertising({
      organizationId: session.organizationId,
      draftId: input.draftId,
      classification: input.classification,
      category: input.category,
      estimatedSpendCents: input.estimatedSpendCents,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "advertising.draft_classified",
      target: `draft:${input.draftId}`,
      details: {
        classification: input.classification,
        category: input.category,
        estimatedSpendCents: input.estimatedSpendCents,
      },
    });
    revalidatePath("/contenuti");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function requestAdvertisingOverrunAction(input: {
  brandId: string;
  category: AdCategory;
  draftId?: string;
  campaignId?: string;
  requestedAmountCents: number;
  motivation: string;
}): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.overrun.request");
  try {
    const req = await createOverrunRequest({
      organizationId: session.organizationId,
      brandId: input.brandId,
      category: input.category,
      ...(input.draftId ? { draftId: input.draftId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      requestedAmountCents: input.requestedAmountCents,
      motivation: input.motivation,
      requestedBy: session.userId,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "advertising.overrun_requested",
      target: `request:${req.id}`,
      details: {
        brandId: input.brandId,
        category: input.category,
        requestedAmountCents: input.requestedAmountCents,
      },
    });
    revalidatePath("/governance/advertising");
    return { ok: true, requestId: req.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function decideAdvertisingOverrunAction(input: {
  requestId: string;
  decision: "approved" | "rejected";
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.overrun.decide");
  try {
    const result = await decideOverrunRequest({
      organizationId: session.organizationId,
      requestId: input.requestId,
      decision: input.decision,
      decidedBy: session.userId,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: `advertising.overrun_${input.decision}`,
      target: `request:${input.requestId}`,
      details: {
        brandId: result.brandId,
        category: result.category,
        requestedAmountCents: result.requestedAmountCents,
      },
    });
    revalidatePath("/governance/advertising");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
