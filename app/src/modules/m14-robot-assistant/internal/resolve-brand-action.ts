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
  const pending = await takePending(actionId, session.userId);
  if (!pending) {
    return { ok: false, status: 404, error: "action_not_found_or_expired" };
  }
  if (pending.organizationId !== session.organizationId) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!pending.needsBrandSelection) {
    return { ok: false, status: 400, error: "not_a_brand_picker_pending" };
  }

  // IDOR guard: il brandId scelto DEVE essere tra quelli consentiti al momento
  // del picker (brand attivi dell'organizzazione). Senza questo check, un
  // attaccante potrebbe POST con brandId di altra org.
  if (!pending.allowedBrandIds || !pending.allowedBrandIds.includes(brandId)) {
    return { ok: false, status: 403, error: "brand_not_allowed" };
  }

  // Merge brandId in toolInput + salva NUOVO pending come write standard
  const updatedInput = {
    ...((pending.toolInput ?? {}) as Record<string, unknown>),
    brandId,
  };
  const newPending = await savePending({
    conversationId: pending.conversationId,
    userId: pending.userId,
    organizationId: pending.organizationId,
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
