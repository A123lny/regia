// M14 robot-assistant — tipi privati del modulo.
// RN-robot: assistente AI in-app (tutor + agente), design 2026-11-16.

export type RobotMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: RobotToolCall[];
  timestamp: string;
};

export type RobotToolCall = {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  status: "pending" | "confirmed" | "executed" | "rejected" | "failed";
};

export type RobotConversation = {
  id: string;
  userId: string;
  organizationId: string;
  brandId: string | null;
  startedAt: string;
  lastMessageAt: string;
  endedAt: string | null;
  toolCallsCount: number;
};

/**
 * Contesto pagina corrente passato dal frontend al backend a ogni messaggio.
 * Il robottino lo usa per capire "dove si trova l'utente" e selezionare i
 * tool contestuali piu' appropriati.
 *
 * brandId: brand selezionato in sessione (design §15: robottino brand-scoped).
 * visibleEntityIds: id delle entita' visibili sulla pagina corrente (es. id del
 *   contatto aperto). Non obbligatorio.
 */
export type RobotPageContext = {
  pagePath: string;
  pageTitle: string;
  brandId: string | null;
  visibleEntityIds?: string[];
};
