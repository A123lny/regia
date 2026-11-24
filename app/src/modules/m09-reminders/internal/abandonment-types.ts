// M9 · da recuperare types.

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

export const ABANDONMENT_SEVERITY_LABELS: Record<AbandonmentSeverity, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

// Mappa codici tecnici resolved_reason -> label leggibile.
// Prima nel log storico apparivano codici come "contattato_e_tornato".
const RESOLVED_REASON_LABELS: Record<string, string> = {
  contattato_e_tornato: "Contattato, è tornato",
  contattato_non_tornato: "Contattato, non è tornato",
  non_piu_cliente: "Non è più cliente",
  errore_segnalazione: "Segnalazione errata",
  altro: "Altro",
};

export function formatResolvedReason(reason: string | null): string {
  if (!reason) return "—";
  return RESOLVED_REASON_LABELS[reason] ?? reason;
}
