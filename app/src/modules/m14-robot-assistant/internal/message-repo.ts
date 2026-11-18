// RN-robot: repo robot_messages (cronologia conversazioni).
// Tutte le funzioni filtrano per organization/user tramite JOIN con
// robot_conversations (IDOR guard applicativo: service_role bypassa RLS).

import { getAdminClient } from "@/lib/db/admin";

export type RobotMessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export async function saveMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Trim a 20000 char max (vincolo DB) per non far fallire l'insert.
  const safeContent = input.content.slice(0, 20000);
  if (safeContent.length === 0) return;
  const { error } = await admin.from("robot_messages").insert({
    conversation_id: input.conversationId,
    role: input.role,
    content: safeContent,
  });
  if (error) {
    // Non bloccante: la chat continua anche se lo storico fallisce.
    console.warn("[robot] saveMessage failed:", error.message);
  }
}

export type ConversationSummary = {
  id: string;
  startedAt: string;
  lastMessageAt: string;
  endedAt: string | null;
  toolCallsCount: number;
  firstUserMessage: string | null;
};

/**
 * Lista le ultime N conversazioni di un utente nell'organizzazione.
 * Include il PRIMO messaggio user come preview.
 */
export async function listUserConversations(
  userId: string,
  organizationId: string,
  limit: number = 20,
): Promise<ConversationSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_conversations")
    .select("id, started_at, last_message_at, ended_at, tool_calls_count")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[robot] listUserConversations: ${error.message}`);

  const conversations = (data ?? []) as Array<{
    id: string;
    started_at: string;
    last_message_at: string;
    ended_at: string | null;
    tool_calls_count: number;
  }>;

  // Fetch del primo messaggio user per ogni conversation (preview)
  const results: ConversationSummary[] = [];
  for (const c of conversations) {
    const { data: firstMsg } = await admin
      .from("robot_messages")
      .select("content")
      .eq("conversation_id", c.id)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    results.push({
      id: c.id,
      startedAt: c.started_at,
      lastMessageAt: c.last_message_at,
      endedAt: c.ended_at,
      toolCallsCount: c.tool_calls_count,
      firstUserMessage: (firstMsg?.content as string | undefined) ?? null,
    });
  }
  return results;
}

/**
 * Lista i messaggi di una conversazione. IDOR guard: verifica che la
 * conversazione appartenga all'utente/org prima di ritornare i messaggi.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  organizationId: string,
): Promise<RobotMessageRow[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // IDOR: check ownership conversation
  const { data: conv } = await admin
    .from("robot_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conv) return null;

  const { data, error } = await admin
    .from("robot_messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[robot] getConversationMessages: ${error.message}`);
  return ((data ?? []) as Array<{
    id: string;
    conversation_id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }));
}
