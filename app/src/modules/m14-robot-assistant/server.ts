// M14 robot-assistant — barrel SERVER-ONLY (RS-1).
// Contiene codice che trascina next/headers, Supabase service_role, Anthropic
// SDK. Non importare da client component — usa public.ts per quelli.

export { RobotWidget } from "./internal/widget";

export { listRobotAccess, getRobotAccess } from "./internal/role-access-repo";

export { runChat } from "./internal/chat-action";
export type { ChatSseEvent, RunChatInput } from "./internal/chat-action";

export { confirmPendingAction } from "./internal/confirm-action";
export type { ConfirmResult } from "./internal/confirm-action";

export { resolveBrandSelection } from "./internal/resolve-brand-action";
export type { ResolveBrandResult } from "./internal/resolve-brand-action";
