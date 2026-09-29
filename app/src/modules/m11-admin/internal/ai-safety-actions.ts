"use server";

// M11 — Server actions per gestione kill switch AI (RF-11.4).
// Owner-only (team.manage): decisione critica, non delegabile all'editor.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { setAiKillSwitch, getAiSafetyStatus } from "./ai-safety";

export async function toggleAiKillSwitch(
  on: boolean,
  reason?: string,
): Promise<{ ok: true; on: boolean } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");

  const trimmedReason = reason?.trim().slice(0, 200) ?? null;
  if (on && trimmedReason && trimmedReason.length < 3) {
    return { ok: false, error: "Motivo troppo corto (min 3 caratteri o omesso)" };
  }

  await setAiKillSwitch(session.organizationId, on, on ? trimmedReason : null);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: on ? "ai_safety.kill_switch_activated" : "ai_safety.kill_switch_deactivated",
    target: `org:${session.organizationId}`,
    details: on ? { reason: trimmedReason ?? null } : {},
  });

  revalidatePath("/impostazioni");
  revalidatePath("/dashboard");
  return { ok: true, on };
}

/**
 * Wrapper server per uso in RSC: ritorna lo stato senza throw se manca session.
 */
export async function fetchAiSafetyStatus(): Promise<{
  killSwitchOn: boolean;
  killSwitchUpdatedAt: string | null;
  killSwitchReason: string | null;
} | null> {
  const session = await getSessionOrRedirect();
  return getAiSafetyStatus(session.organizationId);
}
