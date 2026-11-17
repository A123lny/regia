// RN-robot T10 + fix multi-tenant (20261117): repo per robot_role_access.
// Tutte le funzioni sono scoped per organization_id (RN-87).

import { getAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/auth/session";

export type RobotAccessRow = {
  role: Session["role"];
  enabled: boolean;
};

/** Legge lo stato abilitazione per TUTTI i ruoli di una organizzazione. */
export async function listRobotAccess(organizationId: string): Promise<RobotAccessRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_role_access")
    .select("role, enabled")
    .eq("organization_id", organizationId)
    .order("role");
  if (error) throw new Error(`[robot] listRobotAccess failed: ${error.message}`);
  return (data ?? []) as RobotAccessRow[];
}

/** Legge stato abilitazione per un singolo ruolo in una organizzazione. */
export async function getRobotAccess(
  organizationId: string,
  role: Session["role"],
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_role_access")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("role", role)
    .maybeSingle();
  if (error) {
    console.warn(`[robot] getRobotAccess(${organizationId},${role}) failed: ${error.message}`);
    return false;
  }
  return (data?.enabled as boolean) ?? false;
}

/** Imposta lo stato abilitazione per un ruolo in una organizzazione. */
export async function setRobotAccess(
  organizationId: string,
  role: Session["role"],
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Upsert per supportare anche organizzazioni appena create che non hanno
  // ancora le 4 righe seed.
  const { error } = await admin
    .from("robot_role_access")
    .upsert(
      {
        organization_id: organizationId,
        role,
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "organization_id,role" },
    );
  if (error) throw new Error(`[robot] setRobotAccess failed: ${error.message}`);
}
