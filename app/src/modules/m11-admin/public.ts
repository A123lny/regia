// M11 — Amministrazione. Interfaccia pubblica del modulo (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

export { getRecentAuditEvents } from "./internal/audit-query";
export type { AuditEventRow } from "./internal/audit-query";
