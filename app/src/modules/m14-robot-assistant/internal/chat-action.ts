// RN-robot T5: logica del chat (streaming + tool loop).
// La rotta HTTP /api/robot/chat/route.ts gestisce auth + SSE wrapping,
// delegando qui la logica di invocazione del modello.
//
// NOTE T5: nessun tool ancora passato al modello. T6 aggiungerà il tool loop
// completo (text_delta → tool_use → execute → tool_result → nuovo turn).

import { streamWithTools, type StreamToolsEvent } from "@/lib/ai/anthropic";
import type { Session } from "@/lib/auth/session";
import type { RobotPageContext, RobotMessage } from "./types";
import { buildSystemPrompt } from "./prompt-builder";
import { startConversation, touchConversation } from "./conversation-repo";

export type ChatSseEvent =
  | { type: "conversation_started"; id: string }
  | StreamToolsEvent
  | { type: "error"; code: string; message: string };

export type RunChatInput = {
  session: Session;
  conversationId: string | null;
  userMessage: string;
  priorMessages: RobotMessage[];
  pageContext: RobotPageContext;
};

/**
 * Esegue un turn chat del robottino. Yield-a eventi SSE.
 *
 * Flusso T5:
 *  1. Se conversationId è null, crea una nuova conversazione (yield conversation_started)
 *  2. Costruisce system prompt con contesto pagina + tool list (vuota in T5)
 *  3. Chiama streamWithTools, forward di text_delta, tool_use, done
 *  4. touchConversation alla fine
 */
export async function* runChat(input: RunChatInput): AsyncGenerator<ChatSseEvent> {
  // 1. Conversation
  let convId = input.conversationId;
  if (!convId) {
    convId = await startConversation({
      userId: input.session.userId,
      organizationId: input.session.organizationId,
      brandId: input.pageContext.brandId,
    });
    yield { type: "conversation_started", id: convId };
  }

  // 2. System prompt
  const systemPrompt = buildSystemPrompt({
    pageContext: input.pageContext,
    capabilities: [], // T5: capabilities calcolate in T6 quando introduciamo i tool
    availableTools: [], // T5: nessun tool ancora
  });

  // 3. Costruisci messages per Anthropic: cronologia + delimitatori user_message
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of input.priorMessages) {
    // Delimitatori RA-8.7 solo sui messaggi utente
    history.push({
      role: m.role,
      content: m.role === "user" ? `<user_message>${m.content}</user_message>` : m.content,
    });
  }
  history.push({
    role: "user",
    content: `<user_message>${input.userMessage}</user_message>`,
  });

  // 4. Streaming
  try {
    for await (const event of streamWithTools({
      systemPrompt,
      messages: history,
      tools: [],
    })) {
      yield event;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "errore sconosciuto";
    yield { type: "error", code: "ai_error", message: msg };
  }

  // 5. Touch
  await touchConversation(convId);
}
