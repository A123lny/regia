// RN-robot T3: repository per robot_conversations.
// Tenant-scoped su organization_id (RN-87); accesso via service_role (RS-2).

import { getAdminClient } from "@/lib/db/admin";
import type { RobotConversation } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToConversation(row: any): RobotConversation {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    brandId: row.brand_id ?? null,
    startedAt: row.started_at,
    lastMessageAt: row.last_message_at,
    endedAt: row.ended_at ?? null,
    toolCallsCount: row.tool_calls_count ?? 0,
  };
}

export type StartConversationInput = {
  userId: string;
  organizationId: string;
  brandId: string | null;
};

/**
 * Crea una nuova conversazione robottino.
 * @returns id della conversazione appena creata.
 */
export async function startConversation(input: StartConversationInput): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_conversations")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      brand_id: input.brandId,
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`[robot] startConversation failed: ${error.message}`);
  }
  return data.id as string;
}

/**
 * Tocca una conversazione: aggiorna last_message_at.
 * Se incrementToolCalls=true, incrementa anche il counter dei tool invocati.
 */
export async function touchConversation(
  conversationId: string,
  options: { incrementToolCalls?: boolean } = {},
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  if (options.incrementToolCalls) {
    // Postgres: increment atomico via RPC o update con expression. Supabase JS
    // non ha un helper diretto per "SET col = col + 1" — usiamo una round-trip:
    // read current + write new. Race condition tollerata (contatore informativo,
    // non invariante critico).
    const { data: current } = await admin
      .from("robot_conversations")
      .select("tool_calls_count")
      .eq("id", conversationId)
      .single();
    const newCount = ((current?.tool_calls_count as number) ?? 0) + 1;
    const { error } = await admin
      .from("robot_conversations")
      .update({ last_message_at: new Date().toISOString(), tool_calls_count: newCount })
      .eq("id", conversationId);
    if (error) {
      throw new Error(`[robot] touchConversation failed: ${error.message}`);
    }
    return;
  }

  const { error } = await admin
    .from("robot_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) {
    throw new Error(`[robot] touchConversation failed: ${error.message}`);
  }
}

/** Chiude una conversazione: setta ended_at. */
export async function endConversation(conversationId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("robot_conversations")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) {
    throw new Error(`[robot] endConversation failed: ${error.message}`);
  }
}

/**
 * Legge una conversazione. Filtra per organization_id per isolamento tenant.
 * Ritorna null se la riga non esiste o appartiene ad altra org.
 */
export async function getConversation(
  conversationId: string,
  organizationId: string,
): Promise<RobotConversation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("robot_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    throw new Error(`[robot] getConversation failed: ${error.message}`);
  }
  if (!data) return null;
  return rowToConversation(data);
}
