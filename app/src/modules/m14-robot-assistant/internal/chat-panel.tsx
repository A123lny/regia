"use client";

// RN-robot T5: panel chat connesso a /api/robot/chat via SSE streaming.

import * as React from "react";
import type { Role } from "@/lib/auth/permissions";
import type { RobotMessage } from "./types";

export function RobotChatPanel({
  userId,
  role,
  pageTitle,
  pagePath,
}: {
  userId: string;
  role: Role;
  pageTitle: string;
  pagePath: string;
}) {
  const [messages, setMessages] = React.useState<RobotMessage[]>([
    {
      role: "assistant",
      content: `Ciao! Sono Regia. In "${pageTitle}" posso aiutarti a capire cosa fare o eseguire azioni al posto tuo. Chiedimi pure.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [convId, setConvId] = React.useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = React.useState<{
    actionId: string;
    toolName: string;
    summary: string;
  } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);

    const userMsg: RobotMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    // Mostro subito l'utente + un assistant vuoto da popolare in streaming
    setMessages((m) => [
      ...m,
      userMsg,
      { role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/robot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: convId,
          priorMessages: messages, // storia prima dell'append corrente
          pageContext: {
            pagePath,
            pageTitle,
            brandId: null, // T4-T5: brand corrente non ancora disponibile client-side; T10 lo passa
          },
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "errore rete");
        appendToLastAssistant(`[errore ${res.status}] ${errText}`);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Parse eventi SSE: linee "data: {...}\n\n"
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = chunk.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          try {
            const event = JSON.parse(line);
            handleEvent(event);
          } catch {
            // ignora frammento mal formato
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "errore sconosciuto";
      appendToLastAssistant(`[errore client] ${msg}`);
    } finally {
      setStreaming(false);
    }
  }

  function handleEvent(event: {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    code?: string;
    message?: string;
    actionId?: string;
    toolName?: string;
    summary?: string;
  }) {
    switch (event.type) {
      case "conversation_started":
        if (event.id) setConvId(event.id);
        break;
      case "text_delta":
        if (event.text) appendToLastAssistant(event.text);
        break;
      case "tool_use":
        // Niente label al utente — distrae dal testo di risposta.
        break;
      case "confirmation_required":
        if (event.actionId && event.toolName && event.summary) {
          setPendingConfirm({
            actionId: event.actionId,
            toolName: event.toolName,
            summary: event.summary,
          });
        }
        break;
      case "done":
        // niente da fare lato UI
        break;
      case "error":
        appendToLastAssistant(`\n\n[errore: ${event.message ?? event.code ?? "?"}]`);
        break;
    }
  }

  async function handleConfirm(confirmed: boolean) {
    if (!pendingConfirm) return;
    const { actionId, toolName, summary } = pendingConfirm;
    setPendingConfirm(null);

    try {
      const res = await fetch("/api/robot/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, confirmed }),
      });
      const data = await res.json();

      if (!confirmed) {
        appendNewAssistant(`❌ Azione annullata: ${summary}`);
        return;
      }

      if (!res.ok) {
        appendNewAssistant(`[errore conferma ${res.status}] ${data?.error ?? "?"}`);
        return;
      }

      const out = data.output as { message?: string; error?: string } | undefined;
      if (out?.error) {
        appendNewAssistant(`❌ ${toolName} fallito: ${out.error}`);
      } else {
        appendNewAssistant(`✅ ${out?.message ?? `${toolName} eseguito.`}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "errore rete";
      appendNewAssistant(`[errore rete conferma] ${msg}`);
    }
  }

  function appendNewAssistant(text: string) {
    setMessages((m) => [
      ...m,
      { role: "assistant", content: text, timestamp: new Date().toISOString() },
    ]);
  }

  function appendToLastAssistant(chunk: string) {
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
      }
      return copy;
    });
  }

  // Suppress unused warnings for props reserved for next tasks.
  void userId;
  void role;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        data-testid="robot-messages"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "assistant"
                ? "rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
                : "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
        {pendingConfirm && (
          <div
            className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-sm"
            data-testid="robot-confirm-dialog"
          >
            <div className="mb-2 font-semibold">⚠️ Serve la tua conferma</div>
            <div className="mb-3">{pendingConfirm.summary}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleConfirm(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                data-testid="robot-confirm-yes"
              >
                Sì, conferma
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm"
                data-testid="robot-confirm-no"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Scrivi qui..."
            rows={2}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="robot-input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            data-testid="robot-send"
          >
            {streaming ? "..." : "Invia"}
          </button>
        </div>
      </div>
    </div>
  );
}
