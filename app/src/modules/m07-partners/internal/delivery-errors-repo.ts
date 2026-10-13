// RN-28 Errori consegna ristorante — repo.
// Soglie dal capitolato: 1/mese fisiologico, 3/mese = allarme.

import { getAdminClient } from "@/lib/db/admin";

export type DeliveryErrorSeverity = "bassa" | "media" | "alta";

export type DeliveryError = {
  id: string;
  organizationId: string;
  partnerId: string;
  orderId: string | null;
  compensationVoucherId: string | null;
  reason: string;
  severity: DeliveryErrorSeverity;
  occurredAt: string;
  reportedBy: string | null;
  notes: string | null;
  createdAt: string;
};

export const SEVERITY_LABELS: Record<DeliveryErrorSeverity, string> = {
  bassa: "Bassa",
  media: "Media",
  alta: "Alta",
};

export const SEVERITY_STYLES: Record<DeliveryErrorSeverity, string> = {
  bassa: "border-text-muted/30 bg-text-muted/10 text-text-muted",
  media: "border-warning/40 bg-warning/15 text-warning",
  alta: "border-danger/40 bg-danger/15 text-danger",
};

export type PartnerErrorsSummary = {
  partnerId: string;
  countLast30d: number;
  countPrevious30d: number;
  // RN-28 soglie: alertLevel ="ok"(0-1), "warn"(2), "alert"(>=3).
  alertLevel: "ok" | "warn" | "alert";
  lastError: DeliveryError | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToError(row: any): DeliveryError {
  return {
    id: row.id,
    organizationId: row.organization_id,
    partnerId: row.partner_id,
    orderId: row.order_id ?? null,
    compensationVoucherId: row.compensation_voucher_id ?? null,
    reason: row.reason,
    severity: row.severity as DeliveryErrorSeverity,
    occurredAt: row.occurred_at,
    reportedBy: row.reported_by ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Riassunto errori partner: count ultimi 30gg + livello allarme.
 * Null se partner non esiste. Count = 0 se partner esiste ma mai errori.
 */
export async function getPartnerErrorsSummary(
  organizationId: string,
  partnerId: string,
): Promise<PartnerErrorsSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [last30, prev30, latest] = await Promise.all([
    admin
      .from("partner_delivery_errors")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("partner_id", partnerId)
      .gte("occurred_at", thirtyDaysAgo),
    admin
      .from("partner_delivery_errors")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("partner_id", partnerId)
      .gte("occurred_at", sixtyDaysAgo)
      .lt("occurred_at", thirtyDaysAgo),
    admin
      .from("partner_delivery_errors")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("partner_id", partnerId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (last30.error) throw new Error(`errors last30: ${last30.error.message}`);
  if (prev30.error) throw new Error(`errors prev30: ${prev30.error.message}`);
  if (latest.error) throw new Error(`errors latest: ${latest.error.message}`);

  const countLast30d = last30.count ?? 0;
  const alertLevel: "ok" | "warn" | "alert" =
    countLast30d >= 3 ? "alert" : countLast30d === 2 ? "warn" : "ok";

  return {
    partnerId,
    countLast30d,
    countPrevious30d: prev30.count ?? 0,
    alertLevel,
    lastError: latest.data ? rowToError(latest.data) : null,
  };
}

/**
 * Ultimi N errori del partner, piu' recenti prima.
 */
export async function listPartnerErrors(
  organizationId: string,
  partnerId: string,
  limit = 10,
): Promise<DeliveryError[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("partner_delivery_errors")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("partner_id", partnerId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPartnerErrors: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToError);
}

export type RecordDeliveryErrorInput = {
  organizationId: string;
  partnerId: string;
  reason: string;
  severity?: DeliveryErrorSeverity;
  orderId?: string | null;
  compensationVoucherId?: string | null;
  reportedBy?: string | null;
  notes?: string | null;
};

export async function recordDeliveryError(input: RecordDeliveryErrorInput): Promise<DeliveryError> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    partner_id: input.partnerId,
    reason: input.reason.trim(),
    severity: input.severity ?? "media",
    order_id: input.orderId ?? null,
    compensation_voucher_id: input.compensationVoucherId ?? null,
    reported_by: input.reportedBy ?? null,
    notes: input.notes?.trim() || null,
  };
  const { data, error } = await admin
    .from("partner_delivery_errors")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`recordDeliveryError: ${error.message}`);
  return rowToError(data);
}
