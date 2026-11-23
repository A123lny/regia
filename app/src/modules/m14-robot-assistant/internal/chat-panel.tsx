"use client";

// RN-robot T5: panel chat connesso a /api/robot/chat via SSE streaming.

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth/permissions";
import type { RobotMessage } from "./types";

// Persistenza intra-sessione (sopravvive a close Sheet + refresh pagina,
// NON tra tab/browser diversi — design §3 non-goal cross-session memory).
// Scope per userId per non leakare chat tra utenti diversi sullo stesso browser.
type PersistedState = { messages: RobotMessage[]; convId: string | null };

function storageKey(userId: string): string {
  return `regia-robot-chat-v1:${userId}`;
}

function isValidMessage(m: unknown): m is RobotMessage {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return (
    (x["role"] === "user" || x["role"] === "assistant") &&
    typeof x["content"] === "string" &&
    typeof x["timestamp"] === "string"
  );
}

function loadPersisted(userId: string): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const msgs = Array.isArray(obj["messages"])
      ? (obj["messages"] as unknown[]).filter(isValidMessage)
      : [];
    const convId =
      typeof obj["convId"] === "string" || obj["convId"] === null
        ? (obj["convId"] as string | null)
        : null;
    return { messages: msgs, convId };
  } catch {
    return null;
  }
}

function savePersisted(userId: string, state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // quota exceeded o altro: ignora
  }
}

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
  // Lazy init via useState: loadPersisted() gira una sola volta al mount,
  // evita di toccare un ref durante il render (vietato in React 19).
  // Fallback a messaggio di benvenuto se non c'e' persistenza.
  // Nota: SSR ritorna sempre null (no window), il client fa l'hydration e poi
  // carica. Per evitare mismatch in hydration partiamo dal benvenuto, e
  // montiamo la persistenza dopo via useEffect.
  const initialGreeting = React.useMemo<RobotMessage[]>(
    () => [
      {
        role: "assistant",
        content: `Ciao! Sono Regia. In "${pageTitle}" posso aiutarti a capire cosa fare o eseguire azioni al posto tuo. Chiedimi pure.`,
        timestamp: new Date().toISOString(),
      },
    ],
    [pageTitle],
  );
  const [messages, setMessages] = React.useState<RobotMessage[]>(initialGreeting);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [convId, setConvId] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydration: carichiamo la persistenza dopo il mount per non divergere dal SSR.
  // setState in effect e' intenzionale qui: stiamo sincronizzando con sessionStorage
  // (external system), caso previsto dal pattern.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    const p = loadPersisted(userId);
    if (p) {
      if (p.messages.length > 0) setMessages(p.messages);
      if (p.convId) setConvId(p.convId);
    }
    setHydrated(true);
  }, [userId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const router = useRouter();

  // Persist on changes — ma solo DOPO l'hydration, altrimenti il primo render
  // sovrascriverebbe la persistenza con il greeting iniziale.
  React.useEffect(() => {
    if (!hydrated) return;
    savePersisted(userId, { messages, convId });
  }, [hydrated, userId, messages, convId]);
  const [pendingConfirm, setPendingConfirm] = React.useState<{
    actionId: string;
    toolName: string;
    summary: string;
    // Testo da far rileggere all'utente prima di confermare (es. approveContentDraft).
    // L'approvazione lato server e' legata a questo testo via hash: se il revisore
    // non lo vede, non puo' dare consenso informato. Fail-visible by design.
    reviewText?: string;
  } | null>(null);
  const [pendingBrandPicker, setPendingBrandPicker] = React.useState<{
    actionId: string;
    toolName: string;
    brands: Array<{ id: string; displayName: string; slug: string }>;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyList, setHistoryList] = React.useState<
    Array<{
      id: string;
      startedAt: string;
      lastMessageAt: string;
      toolCallsCount: number;
      firstUserMessage: string | null;
    }>
  >([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
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
      let gotAnyText = false;
      let gotInteraction = false; // confirm/brand picker/tool esposti: lo stream puo' chiudersi senza testo
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
            const event = JSON.parse(line) as { type: string; text?: string };
            if (event.type === "text_delta" && event.text) gotAnyText = true;
            if (
              event.type === "confirmation_required" ||
              event.type === "brand_picker_required"
            ) {
              gotInteraction = true;
            }
            handleEvent(event as Parameters<typeof handleEvent>[0]);
          } catch {
            // ignora frammento mal formato
          }
        }
      }
      // Fallback: se lo stream chiude senza testo ne' interazioni, mostra un messaggio.
      // Fix bug: prima la bolla restava vuota e l'utente non capiva cosa fosse successo.
      if (!gotAnyText && !gotInteraction) {
        appendToLastAssistant(
          "Non sono riuscita a rispondere ora. Riprova tra un istante o riformula la domanda.",
        );
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
    toolInput?: unknown;
    brands?: Array<{ id: string; displayName: string; slug: string }>;
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
          // Per approveContentDraft mostriamo il testo intero su cui il
          // revisore sta per dare conferma. Lo prendiamo dallo snapshot
          // server-side che ha viaggiato in toolInput.reviewedText.
          let reviewText: string | undefined;
          if (event.toolName === "approveContentDraft" && event.toolInput) {
            const inp = event.toolInput as { reviewedText?: unknown };
            if (typeof inp.reviewedText === "string") reviewText = inp.reviewedText;
          }
          setPendingConfirm({
            actionId: event.actionId,
            toolName: event.toolName,
            summary: event.summary,
            ...(reviewText !== undefined && { reviewText }),
          });
        }
        break;
      case "brand_picker_required":
        if (event.actionId && event.toolName && event.brands) {
          setPendingBrandPicker({
            actionId: event.actionId,
            toolName: event.toolName,
            brands: event.brands,
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

  async function handleOpenHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/robot/history");
      const data = await res.json();
      if (res.ok) {
        setHistoryList(data.conversations ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSelectConversation(conversationId: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/robot/history?conversationId=${encodeURIComponent(conversationId)}`,
      );
      const data = await res.json();
      if (!res.ok) return;
      const loaded = (data.messages ?? []) as Array<{
        role: "user" | "assistant";
        content: string;
        createdAt: string;
      }>;
      setMessages(
        loaded.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
      );
      setConvId(conversationId);
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([
      {
        role: "assistant",
        content: `Nuova chat. In "${pageTitle}" posso aiutarti a capire cosa fare o eseguire azioni al posto tuo.`,
        timestamp: new Date().toISOString(),
      },
    ]);
    setConvId(null);
    setPendingConfirm(null);
    setPendingBrandPicker(null);
  }

  async function handleBrandSelect(brandId: string, brandName: string) {
    if (!pendingBrandPicker) return;
    const { actionId } = pendingBrandPicker;
    setPendingBrandPicker(null);
    try {
      const res = await fetch("/api/robot/resolve-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, brandId }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendNewAssistant(`[errore selezione brand ${res.status}] ${data?.error ?? "?"}`);
        return;
      }
      // Ora mostro il confirm dialog con il nuovo actionId
      setPendingConfirm({
        actionId: data.newActionId,
        toolName: data.toolName,
        summary: `${data.summary} (brand: ${brandName})`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "errore rete";
      appendNewAssistant(`[errore rete picker] ${msg}`);
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
        // Ri-fetch dei server component per vedere subito il contatto nuovo /
        // modifica / archiviazione senza che l'utente debba ricaricare la pagina.
        router.refresh();
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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Toolbar: cronologia + nuova chat */}
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
        <button
          type="button"
          onClick={handleOpenHistory}
          className="rounded-md border border-border px-2 py-1 hover:bg-muted"
          data-testid="robot-history-open"
        >
          📋 Cronologia
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          className="rounded-md border border-border px-2 py-1 hover:bg-muted"
          data-testid="robot-new-chat"
        >
          + Nuova chat
        </button>
      </div>

      {/* Overlay cronologia */}
      {historyOpen && (
        <div
          className="absolute inset-0 z-10 flex flex-col bg-background p-4"
          data-testid="robot-history-overlay"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Conversazioni recenti</h3>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="rounded-md border border-border px-2 py-1 text-sm"
            >
              Chiudi
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {historyLoading && <div className="text-sm text-text-muted">Carico...</div>}
            {!historyLoading && historyList.length === 0 && (
              <div className="text-sm text-text-muted">Nessuna conversazione precedente.</div>
            )}
            {historyList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectConversation(c.id)}
                className="block w-full rounded-md border border-border p-3 text-left text-sm hover:bg-muted"
              >
                <div className="mb-1 text-xs text-text-muted">
                  {new Date(c.lastMessageAt).toLocaleString("it-IT")}
                  {c.toolCallsCount > 0 && ` · ${c.toolCallsCount} azioni`}
                </div>
                <div className="line-clamp-2">
                  {c.firstUserMessage ?? "(conversazione vuota)"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
        {pendingBrandPicker && (
          <div
            className="rounded-lg border-2 border-primary bg-primary/5 p-3 text-sm"
            data-testid="robot-brand-picker"
          >
            <div className="mb-2 font-semibold">🏷️ Scegli il brand</div>
            <div className="mb-3 text-text-muted">
              Clicca il marchio su cui procedere con l&apos;azione.
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingBrandPicker.brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleBrandSelect(b.id, b.displayName)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground"
                  data-testid={`robot-brand-pick-${b.slug}`}
                >
                  {b.displayName}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPendingBrandPicker(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
        {pendingConfirm && (
          <div
            className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-sm"
            data-testid="robot-confirm-dialog"
          >
            <div className="mb-2 font-semibold">⚠️ Serve la tua conferma</div>
            <div className="mb-3">{pendingConfirm.summary}</div>
            {pendingConfirm.reviewText !== undefined && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
                  Testo che stai approvando (rileggilo)
                </div>
                <pre
                  className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface p-2 text-xs"
                  data-testid="robot-confirm-review-text"
                >
                  {pendingConfirm.reviewText}
                </pre>
              </div>
            )}
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
