// M14 robot-assistant — interfaccia pubblica (RS-1).
// Tutto cio che non e' esportato qui e' privato: non importarlo da fuori.
//
// Design: docs/superpowers/specs/2026-11-16-robottino-ai-regia-design.md
// Plan:   docs/superpowers/plans/2026-11-16-robottino-ai-regia.md

// Types
export type {
  RobotMessage,
  RobotToolCall,
  RobotConversation,
  RobotPageContext,
} from "./internal/types";

// UI
export { RobotWidget } from "./internal/widget";
