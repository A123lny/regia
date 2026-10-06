// M09 Reminders — barrel SERVER-ONLY (RS-1 split per Turbopack bundling).
// Contiene gli helper che importano m05-publishing (-> adapter Twilio/Resend,
// Node-only). I client component DEVONO importare da ./public.ts che non
// trascina queste dipendenze (tree-shake sulle barrel non e' affidabile su
// alcune versioni di Turbopack).

// Event-driven trigger (usato da m10-signup + m06-loyalty)
export {
  scheduleWelcomeReminder,
  refreshVoucherExpiringReminders,
  scheduleVoucherExpiringReminderOnIssue,
} from "./internal/compute-engine";

// M09 -> M05 bridge (importa adapter concreti)
export { getChannelForReminderKind, sendReminderNow } from "./internal/send-reminder";
export type { SendReminderResult } from "./internal/send-reminder";
