// M05 Publishing — barrel SERVER-ONLY (RS-1 split per Turbopack bundling).
// adapter-registry importa adapter-twilio (-> twilio Node-only con fs/https).
// Qualsiasi client component che importi da public.ts tree-shake male e
// trascina twilio nel bundle browser (Can't resolve 'fs'). Teniamo qui gli
// export che richiedono il grafo adapter.

export { getAdapter } from "./internal/adapter-registry";
export { sendMessage } from "./internal/send-message";
export type { SendMessageInput } from "./internal/send-message";
export { tickBatch } from "./internal/worker";
export type { TickResult } from "./internal/worker";
