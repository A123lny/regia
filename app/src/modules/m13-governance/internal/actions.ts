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
