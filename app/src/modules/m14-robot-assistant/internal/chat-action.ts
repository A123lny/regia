// RN-robot T6: logica del chat con tool loop completo.

import {
  streamWithTools,
  type StreamToolsEvent,
  type StreamMessage,
  type AnthropicContentBlock,
} from "@/lib/ai/anthropic";
import type { Session } from "@/lib/auth/session";
import { hasCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  assertBudgetOk,
  logSpend,
  AiBudgetExceededError,
} from "@/modules/m11-admin/public";
import type { RobotPageContext, RobotMessage } from "./types";
import { buildSystemPrompt } from "./prompt-builder";
import {
  startConversation,
  touchConversation,
  getConversation,
} from "./conversation-repo";
import { ROBOT_TOOLS, getToolsForRole, toAnthropicTools, type RobotTool } from "./tools/registry";
import { checkRateLimit } from "./rate-limiter";

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

const MAX_TOOL_TURNS = 3;

/**
 * Esegue un turn chat del robottino con tool loop.
 *
 * Flusso T6:
 *  1. Verifica/crea conversazione (IDOR guard)
 *  2. Costruisce system prompt con tool disponibili per il ruolo
 *  3. Loop fino a MAX_TOOL_TURNS:
 *     a. Chiama streamWithTools, yield text_delta e tool_use eventi
 *     b. Se tool_use presenti, esegue, aggiunge risultati a history, nuovo turn
 *     c. Se done senza tool_use, chiude
 *  4. touchConversation alla fine
 */
export async function* runChat(input: RunChatInput): AsyncGenerator<ChatSseEvent> {
  // 0a. Rate limit (20 msg/min/user)
  const rl = checkRateLimit(input.session.userId);
  if (!rl.ok) {
    yield {
      type: "error",
      code: "rate_limited",
      message: `Troppi messaggi, riprova tra ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
    };
    return;
  }

  // 0b. Budget gate — fail CLOSED su qualsiasi errore (anche non-AiBudgetExceeded):
  // se non sappiamo se il budget regge, non invochiamo Claude.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assertBudgetOk(input.session.organizationId, "anthropic-robot" as any);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      yield {
        type: "error",
        code: "budget_exceeded",
        message: "Budget mensile AI del robottino esaurito. Contatta un owner.",
      };
      return;
    }
    // Errore inatteso: fail closed
    yield {
      type: "error",
      code: "budget_check_failed",
      message: "Controllo budget fallito, riprova piu' tardi.",
    };
    console.error("[robot] budget check error:", err);
    return;
  }

  // 1. Conversation
  let convId = input.conversationId;
  if (convId) {
    const existing = await getConversation(convId, input.session.organizationId);
    if (!existing || existing.userId !== input.session.userId) {
      yield {
        type: "error",
        code: "conversation_forbidden",
        message: "Conversazione non trovata o non autorizzata",
      };
      return;
    }
  } else {
    convId = await startConversation({
      userId: input.session.userId,
      organizationId: input.session.organizationId,
      brandId: input.pageContext.brandId,
    });
    yield { type: "conversation_started", id: convId };
  }

  // 2. Tool set per ruolo.
  // In questa release esponiamo SOLO read. I tool write (createContact/updateContact)
  // esistono nel registry ma vengono esposti al modello solo quando T8 avra'
  // implementato il confirm flow con conferma esplicita utente (mitigazione
  // indirect prompt injection via tool_result data). Deliberate choice.
  const availableTools = getToolsForRole(input.session.role, ["read"]);

  // 3. System prompt
  const systemPrompt = buildSystemPrompt({
    pageContext: input.pageContext,
    capabilities: availableTools
      .map((t) => t.requiredCapability)
      .filter((c): c is string => c !== null),
    availableTools: availableTools.map((t) => ({
      name: t.name,
      description: t.description,
    })),
  });

  // 4. History iniziale con delimitatori <user_message>
  const history: StreamMessage[] = [];
  for (const m of input.priorMessages) {
    history.push({
      role: m.role,
      content: m.role === "user" ? `<user_message>${m.content}</user_message>` : m.content,
    });
  }
  history.push({
    role: "user",
    content: `<user_message>${input.userMessage}</user_message>`,
  });

  const ctx = { session: input.session, pageContext: input.pageContext };
  let totalToolCalls = 0;

  // 5. Tool loop
  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const pendingToolCalls: Array<{ id: string; name: string; input: unknown }> = [];
    let textAccumulated = "";

    try {
      for await (const event of streamWithTools({
        systemPrompt,
        messages: history,
        tools: toAnthropicTools(availableTools),
      })) {
        if (event.type === "text_delta") {
          textAccumulated += event.text;
          yield event;
        } else if (event.type === "tool_use") {
          pendingToolCalls.push({ id: event.id, name: event.name, input: event.input });
          yield event;
        } else if (event.type === "done") {
          // Log spesa Anthropic (cost tracking per budget)
          try {
            await logSpend({
              organizationId: input.session.organizationId,
              brandId: input.pageContext.brandId ?? undefined,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              category: "anthropic-robot" as any,
              action: "robot.chat",
              costUsd: event.costUsd,
              tokensIn: event.tokensIn,
              tokensOut: event.tokensOut,
              targetType: "robot_conversation",
              targetId: convId,
            });
          } catch (e) {
            console.warn("[robot] logSpend failed:", e);
          }

          // Fine turno: decidiamo se continuare in loop o chiudere
          if (pendingToolCalls.length === 0) {
            yield event;
            await touchConversation(convId);
            return;
          }
          // Eseguo i tool, aggiungo blocchi a history e continuo loop
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "errore sconosciuto";
      yield { type: "error", code: "ai_error", message: msg };
      await touchConversation(convId);
      return;
    }

    // Nessun tool da eseguire e il for è terminato senza done → errore stream
    if (pendingToolCalls.length === 0) {
      await touchConversation(convId);
      return;
    }

    // Push assistant turn con tool_use blocks + eventuale testo precedente
    const assistantBlocks: AnthropicContentBlock[] = [];
    if (textAccumulated.length > 0) {
      assistantBlocks.push({ type: "text", text: textAccumulated });
    }
    for (const tc of pendingToolCalls) {
      assistantBlocks.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: tc.input,
      });
    }
    history.push({ role: "assistant", content: assistantBlocks });

    // Esecuzione tool + push user turn con tool_result blocks
    const toolResultBlocks: AnthropicContentBlock[] = [];
    for (const tc of pendingToolCalls) {
      totalToolCalls++;
      const tool: RobotTool | undefined = ROBOT_TOOLS[tc.name];
      if (!tool) {
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: JSON.stringify({ error: "tool_unknown", name: tc.name }),
          is_error: true,
        });
        continue;
      }
      // Capability guard
      if (
        tool.requiredCapability &&
        !hasCapability(input.session.role, tool.requiredCapability as Capability)
      ) {
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: JSON.stringify({
            error: "capability_mancante",
            required: tool.requiredCapability,
          }),
          is_error: true,
        });
        continue;
      }
      try {
        const output = await tool.execute(tc.input, ctx);
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: JSON.stringify(output),
        });
        // Audit: ogni tool-call del robottino va in audit_events (RA-8.12)
        try {
          // Audit con data minimization: solo metadata, NO contenuti utente o
          // dati di contatti (potrebbero contenere PII — RF-11.3 + GDPR).
          const inputKeys =
            typeof tc.input === "object" && tc.input !== null
              ? Object.keys(tc.input as object)
              : [];
          const outputKeys =
            typeof output === "object" && output !== null
              ? Object.keys(output as object)
              : [];
          await logAuditEvent({
            organizationId: input.session.organizationId,
            actorUserId: input.session.userId,
            actorKind: "agent",
            action: `robot.${tc.name}`,
            target: null,
            details: {
              source: "robot-assistant",
              conversation_id: convId,
              tool_input_keys: inputKeys,
              tool_output_keys: outputKeys,
              page_path: input.pageContext.pagePath,
              brand_id: input.pageContext.brandId,
              user_message_length: input.userMessage.length,
            },
          });
        } catch (auditErr) {
          console.warn("[robot] audit log failed:", auditErr);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "errore esecuzione tool";
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: JSON.stringify({ error: msg }),
          is_error: true,
        });
      }
    }
    history.push({ role: "user", content: toolResultBlocks });
  }

  // Esaurito MAX_TOOL_TURNS senza arrivare a done finale
  yield {
    type: "error",
    code: "tool_loop_exhausted",
    message: `Loop tool oltre ${MAX_TOOL_TURNS} turni. Chiedi all'utente di riformulare.`,
  };
  await touchConversation(convId, { incrementToolCalls: totalToolCalls > 0 });
}
