// M09 Reminders — types RF-6.22 promemoria automatici.

export type ReminderKind =
  | "welcome"
  | "thanks_order"
  | "service_call"
  | "voucher_expiring"
  | "counter_close"
  | "dormant_reactivation"
  | "review_request";

export type ReminderChannelHint = "email" | "sms" | "whatsapp" | "misto";
export type ReminderStatus = "pending" | "sent" | "dismissed" | "expired";
export type ReminderReferenceType =
  "voucher" | "order" | "vehicle" | "counter" | "signup" | "abandonment_signal";

export type Reminder = {
  id: string;
  organizationId: string;
  brandId: string;
  contactId: string;
  kind: ReminderKind;
  channelHint: ReminderChannelHint | null;
  status: ReminderStatus;
  referenceType: ReminderReferenceType | null;
  referenceId: string | null;
  scheduledAt: string;
  sentAt: string | null;
  dismissedAt: string | null;
  messageHint: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// UI labels
export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  welcome: "Benvenuto",
  thanks_order: "Ringraziamento ordine",
  service_call: "Richiamo officina",
  voucher_expiring: "Voucher in scadenza",
  counter_close: "Vicino alla soglia",
  dormant_reactivation: "Cliente dormiente",
  review_request: "Richiesta recensione",
};

export const REMINDER_KIND_ICONS: Record<ReminderKind, string> = {
  welcome: "sparkles",
  thanks_order: "heart",
  service_call: "wrench",
  voucher_expiring: "clock",
  counter_close: "target",
  dormant_reactivation: "user-x",
  review_request: "star",
};

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: "Da fare",
  sent: "Inviato",
  dismissed: "Ignorato",
  expired: "Scaduto",
};

export const REMINDER_STATUS_STYLES: Record<ReminderStatus, string> = {
  pending: "border-primary/40 bg-primary/15 text-primary",
  sent: "border-success/40 bg-success/15 text-success",
  dismissed: "border-text-muted/40 bg-text-muted/15 text-text-muted",
  expired: "border-danger/40 bg-danger/15 text-danger",
};
