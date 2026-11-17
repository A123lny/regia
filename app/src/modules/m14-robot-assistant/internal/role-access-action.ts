"use server";

// RN-robot T10: Server Action per aggiornare robot_role_access.
// Capability richiesta: 'governance.crud' (coerente con altre modifiche di
// configurazione di governance).

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { setRobotAccess } from "./role-access-repo";

const VALID_ROLES = ["owner", "editor", "delegate", "agent"] as const;

export async function setRobotAccessAction(input: {
  role: "owner" | "editor" | "delegate" | "agent";
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "governance.crud");
  } catch {
    return { ok: false, error: "Non autorizzato a modificare la governance." };
  }

  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: "Ruolo non valido" };
  }

  try {
    await setRobotAccess(session.organizationId, input.role, input.enabled, session.userId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "robot.access.updated",
      target: `role:${input.role}`,
      details: {
        enabled: input.enabled,
        source: "robot-assistant",
      },
    });
    revalidatePath("/governance");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
