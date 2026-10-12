// M10 Signup — barrel SERVER-ONLY (RS-1 split per Turbopack bundling).
// submitPublicSignup importa m06-loyalty/server + m09-reminders/server, che a
// loro volta trascinano m05-publishing adapter twilio. Qualsiasi client che
// importi da public.ts (es. signup-client.tsx) tree-shake male e lamenta
// Can't resolve 'fs'. Teniamo qui gli export che richiedono il grafo adapter.

export { submitPublicSignup } from "./internal/public-signup";
export type { PublicSignupInput, PublicSignupResult } from "./internal/public-signup";
