// RN-robot T8 v2: pending actions store su DB (robot_pending_actions).
// Sostituisce il vecchio in-memory Map che si perdeva tra cold start Vercel.
// TTL 5 minuti via expires_at. IDOR: user_id + organization_id nella tabella.
//
// NOTA security: NON persistiamo il role dell'utente perche' sarebbe stale
// al momento del consume (l'utente potrebbe aver cambiato ruolo nel frattempo
// o esserci timing-attack su privilege). Il consumer ricostruisce la session
// corrente dal request e la usa per capability check + execute.

import { getAdminClient } from "@/lib/db/admin";
import type { RobotPageContext } from "./types";

export type PendingAction = {
  id: string;
  conversationId: string;
  // Identita' creator per IDOR guard (comparati con session.userId/orgId del caller).
  userId: string;
  organizationId: string;
  pageContext: RobotPageContext;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
  createdAt: number;
  needsBrandSelection?: boolean;
  allowedBrandIds?: string[];
};

export async function savePending(
  action: Omit<PendingAction, "id" | "createdAt">,
): Promise<PendingAction> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_pending_actions")
    .insert({
      conversation_id: action.conversationId,
      user_id: action.userId,
      organization_id: action.organizationId,
      tool_name: action.toolName,
      tool_input: action.toolInput,
      tool_use_id: action.toolUseId,
      page_context: action.pageContext,
      needs_brand_selection: action.needsBrandSelection ?? false,
      allowed_brand_ids: action.allowedBrandIds ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) {
    throw new Error(`[robot] savePending failed: ${error.message}`);
  }
  return {
    ...action,
    id: data.id as string,
    createdAt: new Date(data.created_at as string).getTime(),
  };
}

/**
 * Prende atomicamente (DELETE ... RETURNING) la pending valida (non scaduta).
 * Scoped sull'utente caller per difesa in profondita' oltre all'IDOR check.
 */
export async function takePending(
  id: string,
  callerUserId: string,
): Promise<PendingAction | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Atomic: delete + select = row ritornata solo se match (TTL + user).
  const { data, error } = await admin
    .from("robot_pending_actions")
    .delete()
    .eq("id", id)
    .eq("user_id", callerUserId)
    .gte("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  if (error || !data) return null;

  const row = data as {
    id: string;
    conversation_id: string;
    user_id: string;
    organization_id: string;
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
    page_context: RobotPageContext;
    needs_brand_selection: boolean;
    allowed_brand_ids: string[] | null;
    created_at: string;
  };

  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    pageContext: row.page_context,
    toolName: row.tool_name,
    toolInput: row.tool_input,
    toolUseId: row.tool_use_id,
    createdAt: new Date(row.created_at).getTime(),
    needsBrandSelection: row.needs_brand_selection,
    ...(row.allowed_brand_ids && { allowedBrandIds: row.allowed_brand_ids }),
  };
}

/** Utility per test. */
export async function clearPending(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  await admin.from("robot_pending_actions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
