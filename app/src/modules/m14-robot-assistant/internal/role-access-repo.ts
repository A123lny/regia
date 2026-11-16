// RN-robot T10: repo per robot_role_access.

import { getAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/auth/session";

export type RobotAccessRow = {
  role: Session["role"];
  enabled: boolean;
};

/** Legge lo stato abilitazione per TUTTI i ruoli. */
export async function listRobotAccess(): Promise<RobotAccessRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_role_access")
    .select("role, enabled")
    .order("role");
  if (error) throw new Error(`[robot] listRobotAccess failed: ${error.message}`);
  return (data ?? []) as RobotAccessRow[];
}

/** Legge stato abilitazione per un singolo ruolo. Default false se non trovato. */
export async function getRobotAccess(role: Session["role"]): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_role_access")
    .select("enabled")
    .eq("role", role)
    .maybeSingle();
  if (error) {
    console.warn(`[robot] getRobotAccess(${role}) failed: ${error.message}`);
    return false;
  }
  return (data?.enabled as boolean) ?? false;
}

/** Imposta lo stato abilitazione per un ruolo. */
export async function setRobotAccess(
  role: Session["role"],
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("robot_role_access")
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq("role", role);
  if (error) throw new Error(`[robot] setRobotAccess failed: ${error.message}`);
}
