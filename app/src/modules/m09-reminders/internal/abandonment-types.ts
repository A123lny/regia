// M9 · anti-abbandono types.

export type AbandonmentKind = "skipped_week" | "dropped_frequency" | "silence_gap" | "inactivity";

export type AbandonmentSeverity = "low" | "medium" | "high";

export type AbandonmentSignal = {
  id: string;
  organizationId: string;
  brandId: string;
  contactId: string;
  kind: AbandonmentKind;
  severity: AbandonmentSeverity;
  signalAt: string;
  windowStart: string;
  windowEnd: string;
  previousOrdersCount: number;
  currentOrdersCount: number;
  resolvedAt: string | null;
  resolvedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ABANDONMENT_KIND_LABELS: Record<AbandonmentKind, string> = {
  skipped_week: "Ha saltato la settimana",
  dropped_frequency: "Frequenza dimezzata",
  silence_gap: "Silenzio 30+gg",
  inactivity: "Inattività 60+gg",
};

export const ABANDONMENT_SEVERITY_STYLES: Record<AbandonmentSeverity, string> = {
  low: "border-text-muted/40 bg-text-muted/15 text-text-muted",
  medium: "border-warning/40 bg-warning/15 text-warning",
  high: "border-danger/40 bg-danger/15 text-danger",
};
