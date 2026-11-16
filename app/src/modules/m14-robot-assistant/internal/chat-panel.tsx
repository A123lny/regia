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
  }) {
    switch (event.type) {
      case "conversation_started":
        if (event.id) setConvId(event.id);
        break;
      case "text_delta":
        if (event.text) appendToLastAssistant(event.text);
        break;
      case "tool_use":
        appendToLastAssistant(`\n\n_[tool: ${event.name ?? "?"}]_`);
        break;
      case "done":
        // niente da fare lato UI
        break;
      case "error":
        appendToLastAssistant(`\n\n[errore: ${event.message ?? event.code ?? "?"}]`);
        break;
    }
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
                ? "rounded-lg bg-muted px-3 py-2 text-sm"
                : "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm"
            }
          >
            {m.content}
          </div>
        ))}
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
