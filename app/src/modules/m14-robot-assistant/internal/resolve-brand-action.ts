// RN-robot: risolve il brand picker. Prende una pending "needsBrandSelection",
// merge brandId in toolInput, crea un nuovo pending standard, ritorna newActionId
// + summary per il confirm dialog.

import type { Session } from "@/lib/auth/session";
import { takePending, savePending } from "./pending-actions-store";
import { buildActionSummary } from "./build-action-summary";

export type ResolveBrandResult =
  | {
      ok: true;
      newActionId: string;
      toolName: string;
      summary: string;
    }
  | { ok: false; status: number; error: string };

export async function resolveBrandSelection(
  session: Session,
  actionId: string,
  brandId: string,
): Promise<ResolveBrandResult> {
  const pending = takePending(actionId);
  if (!pending) {
    return { ok: false, status: 404, error: "action_not_found_or_expired" };
  }
  if (
    pending.session.userId !== session.userId ||
    pending.session.organizationId !== session.organizationId
  ) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!pending.needsBrandSelection) {
    return { ok: false, status: 400, error: "not_a_brand_picker_pending" };
  }

  // Merge brandId in toolInput + salva NUOVO pending come write standard
  const updatedInput = {
    ...((pending.toolInput ?? {}) as Record<string, unknown>),
    brandId,
  };
  const newPending = savePending({
    conversationId: pending.conversationId,
    session: pending.session,
    pageContext: pending.pageContext,
    toolName: pending.toolName,
    toolInput: updatedInput,
    toolUseId: pending.toolUseId,
  });
  const summary = buildActionSummary(pending.toolName, updatedInput);
  return {
    ok: true,
    newActionId: newPending.id,
    toolName: pending.toolName,
    summary,
  };
}
