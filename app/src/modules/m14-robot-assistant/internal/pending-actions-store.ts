// RN-robot T8: pending actions store in-memory (TTL 5 minuti).
//
// Quando il modello invoca un tool 'write' o 'destructive', NON eseguiamo
// subito. Salviamo la pending action qui e aspettiamo che l'utente confermi
// via UI (POST /api/robot/confirm). Il server execute solo dopo conferma.
//
// KNOWN LIMITATION: in-memory → non sopravvive multi-instance Vercel. OK
// per Hobby single-instance, da migrare a Redis/Postgres pre-Pro.

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
};

const TTL_MS = 5 * 60 * 1000; // 5 minuti
const store = new Map<string, PendingAction>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, action] of store.entries()) {
    if (now - action.createdAt > TTL_MS) store.delete(id);
  }
}

export function savePending(action: Omit<PendingAction, "id" | "createdAt">): PendingAction {
  pruneExpired();
  const id = crypto.randomUUID();
  const full: PendingAction = { ...action, id, createdAt: Date.now() };
  store.set(id, full);
  return full;
}

export function takePending(id: string): PendingAction | null {
  pruneExpired();
  const action = store.get(id);
  if (!action) return null;
  store.delete(id); // one-shot (consumed)
  return action;
}

/** Utility per test. */
export function clearPending(): void {
  store.clear();
}
