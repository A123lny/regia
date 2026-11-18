// RN-robot T8 v2: pending actions store su DB (robot_pending_actions).
// Sostituisce il vecchio in-memory Map che si perdeva tra cold start Vercel.
// TTL 5 minuti via expires_at. IDOR: user_id + organization_id nella tabella.

import { getAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/auth/session";
import type { RobotPageContext } from "./types";

export type PendingAction = {
  id: string;
  conversationId: string;
  session: Session;
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
      user_id: action.session.userId,
      organization_id: action.session.organizationId,
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

export async function takePending(id: string): Promise<PendingAction | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Prima leggo (anche per verificare scadenza), poi cancello (one-shot).
  const { data, error } = await admin
    .from("robot_pending_actions")
    .select("*")
    .eq("id", id)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;

  // One-shot: elimino subito così non riuso
  await admin.from("robot_pending_actions").delete().eq("id", id);

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

  const session: Session = {
    userId: row.user_id,
    // role non serve per il check IDOR (basta user+org match); il chiamante
    // ha la propria session con role corretto. Per compatibilita' struttura:
    role: "owner" as Session["role"],
    organizationId: row.organization_id,
    previousLoginAt: null,
  };

  return {
    id: row.id,
    conversationId: row.conversation_id,
    session,
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
