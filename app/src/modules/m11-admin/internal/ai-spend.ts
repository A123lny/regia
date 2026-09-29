// M11 — RF-11.5 Tetti spesa AI: repo per budget + ledger.

import { getAdminClient } from "@/lib/db/admin";

export type SpendCategory = "anthropic" | "gemini" | "voyage";
export type BudgetCategory = SpendCategory | "all";

export type AiSpendBudget = {
  id: string;
  organizationId: string;
  category: BudgetCategory;
  monthlyCapUsd: number;
  alertThresholdPercent: number;
  isActive: boolean;
  updatedAt: string;
};

export type SpendSummary = {
  category: BudgetCategory;
  spentThisMonthUsd: number;
  capUsd: number | null;
  alertThresholdPercent: number;
  percentUsed: number; // 0-100+
  isActive: boolean;
};

export class AiBudgetExceededError extends Error {
  constructor(category: BudgetCategory, spent: number, cap: number) {
    super(
      `Budget mensile AI (${category}) esaurito: spesi $${spent.toFixed(2)} su $${cap.toFixed(2)}. Aumenta il tetto in /impostazioni.`,
    );
    this.name = "AiBudgetExceededError";
  }
}

/**
 * Ritorna il primo giorno del mese corrente (ISO).
 */
function currentMonthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function listBudgets(organizationId: string): Promise<AiSpendBudget[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("ai_spend_budgets")
    .select(
      "id, organization_id, category, monthly_cap_usd, alert_threshold_percent, is_active, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("category");
  if (error) throw new Error(`Errore lettura budget: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    category: r.category as BudgetCategory,
    monthlyCapUsd: Number(r.monthly_cap_usd),
    alertThresholdPercent: r.alert_threshold_percent,
    isActive: r.is_active,
    updatedAt: r.updated_at,
  }));
}

/**
 * Somma spese del mese corrente per categoria. Se category='all', somma tutte le categorie.
 */
export async function sumSpendThisMonth(
  organizationId: string,
  category: BudgetCategory,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("ai_spend_ledger")
    .select("cost_usd")
    .eq("organization_id", organizationId)
    .gte("occurred_at", currentMonthStartIso());
  if (category !== "all") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(`Errore somma spese: ${error.message}`);
  const rows = (data ?? []) as Array<{ cost_usd: string | number }>;
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}

/**
 * Guardia: throw AiBudgetExceededError se la categoria ha un budget attivo E il
 * mese corrente ha già raggiunto/superato il cap. Da chiamare PRIMA della call AI.
 * Se cost_usd stimato è passato, controlla anche (spent + estimated) vs cap.
 */
export async function assertBudgetOk(
  organizationId: string,
  category: SpendCategory,
  estimatedCostUsd: number = 0,
): Promise<void> {
  const budgets = await listBudgets(organizationId);
  // Verifica prima categoria specifica, poi 'all' (totale)
  for (const cat of [category, "all" as BudgetCategory]) {
    const budget = budgets.find((b) => b.category === cat && b.isActive);
    if (!budget) continue;
    const spent = await sumSpendThisMonth(organizationId, cat);
    if (spent + estimatedCostUsd >= budget.monthlyCapUsd) {
      throw new AiBudgetExceededError(cat, spent, budget.monthlyCapUsd);
    }
  }
}

/**
 * Log append-only di una spesa avvenuta. Da chiamare DOPO ogni call AI riuscita.
 */
export async function logSpend(input: {
  organizationId: string;
  brandId?: string;
  category: SpendCategory;
  action: string;
  costUsd: number;
  tokensIn?: number;
  tokensOut?: number;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    category: input.category,
    action: input.action,
    cost_usd: input.costUsd,
    tokens_in: input.tokensIn ?? 0,
    tokens_out: input.tokensOut ?? 0,
  };
  if (input.brandId) row["brand_id"] = input.brandId;
  if (input.targetType) row["target_type"] = input.targetType;
  if (input.targetId) row["target_id"] = input.targetId;
  const { error } = await admin.from("ai_spend_ledger").insert(row);
  if (error) throw new Error(`Errore log spesa AI: ${error.message}`);
}

/**
 * Summary dashboard: per ogni categoria mostra spent vs cap.
 */
export async function getSpendSummaries(organizationId: string): Promise<SpendSummary[]> {
  const budgets = await listBudgets(organizationId);
  const categories: BudgetCategory[] = ["anthropic", "gemini", "voyage", "all"];
  const summaries: SpendSummary[] = [];
  for (const cat of categories) {
    const spent = await sumSpendThisMonth(organizationId, cat);
    const budget = budgets.find((b) => b.category === cat);
    summaries.push({
      category: cat,
      spentThisMonthUsd: spent,
      capUsd: budget?.monthlyCapUsd ?? null,
      alertThresholdPercent: budget?.alertThresholdPercent ?? 80,
      percentUsed:
        budget && budget.monthlyCapUsd > 0 ? Math.round((spent / budget.monthlyCapUsd) * 100) : 0,
      isActive: budget?.isActive ?? false,
    });
  }
  return summaries;
}

export async function upsertBudget(input: {
  organizationId: string;
  category: BudgetCategory;
  monthlyCapUsd: number;
  alertThresholdPercent?: number;
  isActive?: boolean;
  updatedBy: string;
}): Promise<AiSpendBudget> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("ai_spend_budgets")
    .upsert(
      {
        organization_id: input.organizationId,
        category: input.category,
        monthly_cap_usd: input.monthlyCapUsd,
        alert_threshold_percent: input.alertThresholdPercent ?? 80,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      },
      { onConflict: "organization_id,category" },
    )
    .select(
      "id, organization_id, category, monthly_cap_usd, alert_threshold_percent, is_active, updated_at",
    )
    .single();
  if (error) throw new Error(`Errore upsert budget: ${error.message}`);
  return {
    id: data.id,
    organizationId: data.organization_id,
    category: data.category as BudgetCategory,
    monthlyCapUsd: Number(data.monthly_cap_usd),
    alertThresholdPercent: data.alert_threshold_percent,
    isActive: data.is_active,
    updatedAt: data.updated_at,
  };
}
