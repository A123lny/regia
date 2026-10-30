// M09 Reminders — interfaccia pubblica (RS-1).

export type {
  Reminder,
  ReminderKind,
  ReminderChannelHint,
  ReminderStatus,
  ReminderReferenceType,
} from "./internal/reminders-types";

export {
  REMINDER_KIND_LABELS,
  REMINDER_KIND_ICONS,
  REMINDER_STATUS_LABELS,
  REMINDER_STATUS_STYLES,
} from "./internal/reminders-types";

export { listReminders, getReminder, getRemindersStats } from "./internal/reminders-repo";
export type { ReminderRow, ListRemindersInput } from "./internal/reminders-repo";

// Server actions (bundlate client-side come RPC stubs, non trascinano i file importati)
export {
  dismissReminderAction,
  markReminderSentAction,
  refreshAllRemindersAction,
  sendReminderNowAction,
} from "./internal/actions";
export type { RefreshAllRemindersResult } from "./internal/actions";

// Nota: helper event-driven e M09->M05 bridge sono in ./server.ts
// (barrel server-only, import da server component o server action).

// M9 anti-abbandono (RN-40)
export type {
  AbandonmentKind,
  AbandonmentSeverity,
  AbandonmentSignal,
} from "./internal/abandonment-types";
export { ABANDONMENT_KIND_LABELS, ABANDONMENT_SEVERITY_STYLES } from "./internal/abandonment-types";
export {
  listAbandonmentSignals,
  listResolvedAbandonmentSignals,
  getAbandonmentStats,
} from "./internal/abandonment-repo";
export type { SignalRow as AbandonmentSignalRow } from "./internal/abandonment-repo";
export {
  detectAbandonmentAction,
  resolveAbandonmentSignalAction,
  scheduleQuoteFollowupAction,
} from "./internal/actions";
export type { DetectAbandonmentResult } from "./internal/actions";
