// M14 robot-assistant — barrel CLIENT-SAFE (RS-1).
// Puo' essere importato da client component senza trascinare next/headers o
// SDK server-only. Per API server-only vedere server.ts.
//
// Design: docs/superpowers/specs/2026-11-16-robottino-ai-regia-design.md
// Plan:   docs/superpowers/plans/2026-11-16-robottino-ai-regia.md

// Types (solo dichiarazioni, nessun runtime import server)
export type {
  RobotMessage,
  RobotToolCall,
  RobotConversation,
  RobotPageContext,
} from "./internal/types";

export type { RobotAccessRow } from "./internal/role-access-repo";

// Server Actions ("use server" al top del file): Next le converte in RPC,
// chiamabili da client component senza bundle del codice server.
export { setRobotAccessAction } from "./internal/role-access-action";
