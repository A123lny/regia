// M07 Partners (rete ristoranti Lenny) — types.

export type OnboardingStatus = "mai_partito" | "attivo" | "sospeso" | "uscito";
export type ActivityKind =
  | "chiamata"
  | "incontro"
  | "email"
  | "whatsapp"
  | "follow_up"
  | "segnalazione"
  | "onboarding"
  | "uscita";
export type ActivityOutcome = "positivo" | "neutro" | "negativo" | "da_richiamare";

export type PartnerRestaurant = {
  id: string;
  organizationId: string;
  brandId: string;
  name: string;
  referentName: string | null;
  phone: string | null;
  email: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressCap: string | null;
  cuisineCategory: string | null;
  avgPrepMinutes: number | null;
  onboardingStatus: OnboardingStatus;
  coolingFlag: boolean;
  coolingReason: string | null;
  lastContactAt: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerActivity = {
  id: string;
  organizationId: string;
  partnerId: string;
  kind: ActivityKind;
  outcome: ActivityOutcome | null;
  summary: string;
  occurredAt: string;
  createdBy: string | null;
  createdAt: string;
};

// UI labels
export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  mai_partito: "Mai partito",
  attivo: "Attivo",
  sospeso: "Sospeso",
  uscito: "Uscito",
};

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  chiamata: "Chiamata",
  incontro: "Incontro",
  email: "Email",
  whatsapp: "WhatsApp",
  follow_up: "Follow-up",
  segnalazione: "Segnalazione",
  onboarding: "Onboarding",
  uscita: "Uscita",
};

export const ACTIVITY_OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
  da_richiamare: "Da richiamare",
};

/**
 * Giorni dall'ultimo contatto. Ritorna null se nessuno.
 */
export function daysSinceLastContact(lastContactAt: string | null): number | null {
  if (!lastContactAt) return null;
  return Math.floor((Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24));
}
