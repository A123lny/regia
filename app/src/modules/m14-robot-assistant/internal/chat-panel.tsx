"use client";

// RN-robot T4: panel chat statico (no backend). T5 lo connette a /api/robot/chat.

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
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    // T4: nessuna chiamata backend. Aggiungiamo solo il messaggio utente ed
    // una risposta placeholder. T5 sostituira' con streaming reale.
    setMessages((m) => [
      ...m,
      { role: "user", content: text, timestamp: new Date().toISOString() },
      {
        role: "assistant",
        content: "(connessione al cervello non ancora attiva — T5)",
        timestamp: new Date().toISOString(),
      },
    ]);
    setInput("");
  }

  // Suppress unused warnings for props reserved for T5.
  void userId;
  void role;
  void pagePath;

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
            disabled={!input.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            data-testid="robot-send"
          >
            Invia
          </button>
        </div>
      </div>
    </div>
  );
}
