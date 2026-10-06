// M06 Loyalty — barrel SERVER-ONLY (RS-1 split per Turbopack bundling).
// issueVoucherForSignup importa m09-reminders/server (-> M05 adapter Twilio).
// Deve stare fuori da public.ts, che e' importato anche da client component.

export { issueVoucherForSignup } from "./internal/system-issue";
export type { IssueSystemVoucherInput, IssueSystemVoucherResult } from "./internal/system-issue";
