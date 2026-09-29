// M9 · repo signals + azioni resolve.

import { getAdminClient } from "@/lib/db/admin";
import type { AbandonmentKind, AbandonmentSeverity, AbandonmentSignal } from "./abandonment-types";

const SELECT_COLS =
  "id, organization_id, brand_id, contact_id, kind, severity, signal_at, " +
  "window_start, window_end, previous_orders_count, current_orders_count, " +
  "resolved_at, resolved_reason, notes, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSignal(row: any): AbandonmentSignal {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    contactId: row.contact_id,
    kind: row.kind as AbandonmentKind,
    severity: row.severity as AbandonmentSeverity,
    signalAt: row.signal_at,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    previousOrdersCount: row.previous_orders_count,
    currentOrdersCount: row.current_orders_count,
    resolvedAt: row.resolved_at ?? null,
    resolvedReason: row.resolved_reason ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SignalRow = AbandonmentSignal & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  contactFullName: string | null;
  contactEmail: string | null;
};

export async function listAbandonmentSignals(
  organizationId: string,
  onlyActive: boolean = true,
  limit: number = 200,
): Promise<SignalRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("abandonment_signals")
    .select(
      `${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived), contacts!inner(first_name, last_name, email)`,
    )
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false);
  if (onlyActive) q = q.is("resolved_at", null);
  q = q
    .order("severity", { ascending: false })
    .order("signal_at", { ascending: false })
    .limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(`Errore lista signals: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): SignalRow => {
    const parts = [row.contacts?.first_name, row.contacts?.last_name].filter(
      (v: string | null | undefined): v is string => Boolean(v),
    );
    return {
      ...rowToSignal(row),
      brandSlug: row.brands.slug as string,
      brandDisplayName: row.brands.display_name as string,
      brandColor: row.brands.color as string,
      contactFullName: parts.length > 0 ? parts.join(" ") : null,
      contactEmail: (row.contacts?.email as string | null) ?? null,
    };
  });
}

export async function getAbandonmentStats(organizationId: string): Promise<{
  activeHigh: number;
  activeMedium: number;
  activeLow: number;
  resolvedLast30d: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [hRes, mRes, lRes, rRes] = await Promise.all([
    admin
      .from("abandonment_signals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("severity", "high")
      .is("resolved_at", null),
    admin
      .from("abandonment_signals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("severity", "medium")
      .is("resolved_at", null),
    admin
      .from("abandonment_signals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("severity", "low")
      .is("resolved_at", null),
    admin
      .from("abandonment_signals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("resolved_at", "is", null)
      .gte("resolved_at", thirtyDaysAgo),
  ]);
  if (hRes.error) throw new Error(`Stats high: ${hRes.error.message}`);
  if (mRes.error) throw new Error(`Stats med: ${mRes.error.message}`);
  if (lRes.error) throw new Error(`Stats low: ${lRes.error.message}`);
  if (rRes.error) throw new Error(`Stats resolved: ${rRes.error.message}`);
  return {
    activeHigh: hRes.count ?? 0,
    activeMedium: mRes.count ?? 0,
    activeLow: lRes.count ?? 0,
    resolvedLast30d: rRes.count ?? 0,
  };
}

export async function resolveAbandonmentSignal(
  signalId: string,
  organizationId: string,
  reason: string,
): Promise<AbandonmentSignal | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("abandonment_signals")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_reason: reason,
    })
    .eq("id", signalId)
    .eq("organization_id", organizationId)
    .is("resolved_at", null)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore resolve: ${error.message}`);
  return data ? rowToSignal(data) : null;
}
