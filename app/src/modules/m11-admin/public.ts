// M11 — Amministrazione. Interfaccia pubblica del modulo (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

export { getRecentAuditEvents } from "./internal/audit-query";
export type { AuditEventRow } from "./internal/audit-query";

export { listTeamMembers } from "./internal/team-query";
export type { TeamMember, TeamListFilter } from "./internal/team-query";

export { updateMemberRole, archiveMember, restoreMember } from "./internal/team-actions";

// RF-11.4 AI kill switch + guardia
export { assertAiEnabled, getAiSafetyStatus, AiKillSwitchError } from "./internal/ai-safety";
export type { AiSafetyStatus } from "./internal/ai-safety";
export { toggleAiKillSwitch, fetchAiSafetyStatus } from "./internal/ai-safety-actions";

// RF-2.7 White label platform branding
export { getPlatformBranding } from "./internal/platform-branding";
export type { PlatformBranding } from "./internal/platform-branding";
export {
  updatePlatformBranding,
  uploadPlatformLogo,
  removePlatformLogo,
} from "./internal/platform-branding-actions";

// RF-11.5 Tetti spesa AI
export {
  assertBudgetOk,
  logSpend,
  listBudgets,
  getSpendSummaries,
  AiBudgetExceededError,
} from "./internal/ai-spend";
export type {
  AiSpendBudget,
  SpendSummary,
  SpendCategory,
  BudgetCategory,
} from "./internal/ai-spend";
export { saveAiBudget } from "./internal/ai-spend-actions";
