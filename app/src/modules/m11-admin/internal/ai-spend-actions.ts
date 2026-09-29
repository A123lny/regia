"use server";

// M11 — Server actions gestione budget AI (RF-11.5). Owner-only.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { upsertBudget, type AiSpendBudget, type BudgetCategory } from "./ai-spend";

export async function saveAiBudget(input: {
  category: BudgetCategory;
  monthlyCapUsd: number;
  alertThresholdPercent?: number;
  isActive?: boolean;
}): Promise<AiSpendBudget> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");

  if (input.monthlyCapUsd < 0 || input.monthlyCapUsd > 10000) {
    throw new Error("Cap mensile fuori range (0-10000 USD)");
  }
  const threshold = input.alertThresholdPercent ?? 80;
  if (threshold < 1 || threshold > 100) {
    throw new Error("Soglia allarme deve essere tra 1 e 100");
  }

  const updated = await upsertBudget({
    organizationId: session.organizationId,
    category: input.category,
    monthlyCapUsd: input.monthlyCapUsd,
    alertThresholdPercent: threshold,
    isActive: input.isActive ?? true,
    updatedBy: session.userId,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "ai_spend.budget_updated",
    target: `budget:${input.category}`,
    details: {
      category: input.category,
      monthlyCapUsd: input.monthlyCapUsd,
      alertThresholdPercent: threshold,
      isActive: input.isActive ?? true,
    },
  });

  revalidatePath("/impostazioni");
  return updated;
}
