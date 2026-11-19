// RN-robot T8: logica di conferma/rifiuto di una pending action.
// Espone un'unica funzione per la rotta /api/robot/confirm.

import { revalidatePath } from "next/cache";
import type { Session } from "@/lib/auth/session";
import { hasCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { takePending } from "./pending-actions-store";
import { ROBOT_TOOLS } from "./tools/registry";

// Mappa tool -> path da ri-renderizzare dopo l'esecuzione. Defense in depth
// sopra il revalidatePath che i Server Action di dominio fanno gia'.
const PATHS_BY_TOOL: Record<string, string[]> = {
  createContact: ["/contatti"],
  updateContact: ["/contatti"],
  deleteContact: ["/contatti"],
  createTask: ["/promemoria", "/", "/dashboard"],
  completeTask: ["/promemoria", "/", "/dashboard"],
  reopenTask: ["/promemoria", "/", "/dashboard"],
  cancelTask: ["/promemoria", "/", "/dashboard"],
  updateTask: ["/promemoria", "/", "/dashboard"],
  createPartner: ["/ristoranti", "/fornitori"],
  archivePartner: ["/ristoranti", "/fornitori"],
  logPartnerActivity: ["/ristoranti", "/fornitori", "/", "/dashboard"],
  generateContentDraft: ["/contenuti", "/contenuti/sessione", "/"],
  approveContentDraft: ["/contenuti", "/contenuti/sessione"],
  rejectContentDraft: ["/contenuti", "/contenuti/sessione"],
  scheduleContentDraft: ["/contenuti", "/contenuti/calendario"],
  deleteContentDraft: ["/contenuti"],
};

export type ConfirmResult =
  | { ok: true; rejected: true }
  | { ok: true; rejected: false; output: unknown }
  | { ok: false; status: number; error: string };

export async function confirmPendingAction(
  session: Session,
  actionId: string,
  confirmed: boolean,
): Promise<ConfirmResult> {
  const pending = await takePending(actionId, session.userId);
  if (!pending) {
    return { ok: false, status: 404, error: "action_not_found_or_expired" };
  }

  // IDOR secondary check (takePending gia' filtra per user_id a livello DB)
  if (pending.organizationId !== session.organizationId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  if (!confirmed) {
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: `robot.${pending.toolName}.rejected`,
      details: {
        source: "robot-assistant",
        conversation_id: pending.conversationId,
        tool_input_keys:
          typeof pending.toolInput === "object" && pending.toolInput !== null
            ? Object.keys(pending.toolInput as object)
            : [],
      },
    });
    return { ok: true, rejected: true };
  }

  const tool = ROBOT_TOOLS[pending.toolName];
  if (!tool) return { ok: false, status: 500, error: "tool_not_found" };
  if (
    tool.requiredCapability &&
    !hasCapability(session.role, tool.requiredCapability as Capability)
  ) {
    return { ok: false, status: 403, error: "capability_mancante" };
  }

  try {
    const output = await tool.execute(pending.toolInput, {
      session,
      pageContext: pending.pageContext,
    });

    const inputKeys =
      typeof pending.toolInput === "object" && pending.toolInput !== null
        ? Object.keys(pending.toolInput as object)
        : [];
    const outputKeys =
      typeof output === "object" && output !== null
        ? Object.keys(output as object)
        : [];
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "agent",
      action: `robot.${pending.toolName}`,
      details: {
        source: "robot-assistant",
        conversation_id: pending.conversationId,
        confirmed_by_user: true,
        tool_input_keys: inputKeys,
        tool_output_keys: outputKeys,
      },
    });

    // Invalida le path server component toccate dal tool: il client fa anche
    // router.refresh() ma il revalidatePath lato server garantisce fresh data.
    for (const path of PATHS_BY_TOOL[pending.toolName] ?? []) {
      revalidatePath(path);
    }

    return { ok: true, rejected: false, output };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "execution_failed",
    };
  }
}
