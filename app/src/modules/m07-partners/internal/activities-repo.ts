// M07 Partners — repo attività (log contatti).

import { getAdminClient } from "@/lib/db/admin";
import type { ActivityKind, ActivityOutcome, PartnerActivity } from "./partners-types";

const SELECT_COLS =
  "id, organization_id, partner_id, kind, outcome, summary, occurred_at, created_by, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToActivity(row: any): PartnerActivity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    partnerId: row.partner_id,
    kind: row.kind as ActivityKind,
    outcome: (row.outcome as ActivityOutcome | null) ?? null,
    summary: row.summary,
    occurredAt: row.occurred_at,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  };
}

export async function listActivitiesByPartner(
  partnerId: string,
  organizationId: string,
): Promise<PartnerActivity[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("partner_activities")
    .select(SELECT_COLS)
    .eq("partner_id", partnerId)
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(`Errore lettura attività: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToActivity);
}

export type CreateActivityInput = {
  organizationId: string;
  partnerId: string;
  kind: ActivityKind;
  outcome?: ActivityOutcome | null;
  summary: string;
  occurredAt?: string;
  createdBy?: string | null;
};

export type RecentContactActivity = {
  activityId: string;
  partnerId: string;
  partnerName: string;
  kind: ActivityKind;
  outcome: ActivityOutcome | null;
  summary: string;
  occurredAt: string;
  createdBy: string | null;
};

/**
 * Lista le attivita' di contatto recenti dell'org (default ultime 24h),
 * con join sul nome del partner. Serve alla dashboard per mostrare nella
 * tab "Completati" i segnali gestiti via "Marca come contattato".
 */
export async function listRecentContactActivities(
  organizationId: string,
  hoursBack = 24,
  createdBy?: string,
): Promise<RecentContactActivity[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
  let q = admin
    .from("partner_activities")
    .select("id, partner_id, kind, outcome, summary, occurred_at, created_by, partners(name)")
    .eq("organization_id", organizationId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (createdBy) q = q.eq("created_by", createdBy);
  const { data, error } = await q;
  if (error) throw new Error(`Errore lettura attivita recenti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    activityId: row.id,
    partnerId: row.partner_id,
    partnerName: row.partners?.name ?? "Partner",
    kind: row.kind as ActivityKind,
    outcome: (row.outcome as ActivityOutcome | null) ?? null,
    summary: row.summary,
    occurredAt: row.occurred_at,
    createdBy: row.created_by ?? null,
  }));
}

export async function createActivity(input: CreateActivityInput): Promise<PartnerActivity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    partner_id: input.partnerId,
    kind: input.kind,
    outcome: input.outcome ?? null,
    summary: input.summary.trim(),
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    created_by: input.createdBy ?? null,
  };
  const { data, error } = await admin
    .from("partner_activities")
    .insert(row)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore insert attività: ${error.message}`);
  return rowToActivity(data);
}
