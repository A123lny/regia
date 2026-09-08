// RF-11.3: lettura dell'audit log per l'amministratore.
// Privato del modulo M11: importare tramite public.ts.

import { getAdminClient } from "../../../lib/db/admin";

export type AuditEventRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_kind: "user" | "agent" | "system";
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function getRecentAuditEvents(
  organizationId: string,
  limit = 50,
): Promise<AuditEventRow[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("audit_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`audit query failed: ${error.message}`);
  return (data ?? []) as AuditEventRow[];
}
