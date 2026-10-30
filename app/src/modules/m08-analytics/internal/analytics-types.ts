// M08 Analytics — types read-only aggregate.

export type AnalyticsPeriod = "7d" | "30d" | "90d";

export const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "7d": "Ultimi 7 giorni",
  "30d": "Ultimi 30 giorni",
  "90d": "Ultimi 90 giorni",
};

// ---- Contatti ----
export type ContactsAnalytics = {
  totalActive: number;
  totalArchived: number;
  newInPeriod: number;
  newPreviousPeriod: number;
  bySource: Array<{ source: string; count: number }>;
  consentsByChannel: Array<{ channel: string; granted: number; revoked: number; never: number }>;
};

// ---- Ordini ----
export type OrdersAnalytics = {
  countInPeriod: number;
  totalCentsInPeriod: number;
  totalCentsPreviousPeriod: number;
  avgOrderValueCents: number;
  byChannel: Array<{ channel: string; count: number; totalCents: number }>;
  byStatus: Array<{ status: string; count: number }>;
};

// ---- Fedeltà ----
export type LoyaltyAnalytics = {
  vouchersActive: number;
  vouchersRedeemed: number;
  redemptionRatePct: number; // redeemed / (issued totali)
  expiringNext7d: number;
  topProgressingContacts: Array<{
    contactFullName: string | null;
    counterName: string;
    progress: number;
    threshold: number;
    percentComplete: number;
  }>;
};

// ---- Outreach ----
export type OutreachAnalytics = {
  activeSegments: number;
  totalSegmentedContacts: number;
  campaignsDraft: number;
  campaignsScheduled: number;
  campaignsSent: number;
  lastCampaignSent: {
    name: string;
    channel: string;
    attempted: number;
    delivered: number;
    failed: number;
    sentAt: string;
  } | null;
};

// ---- Partner Lenny ----
export type PartnersAnalytics = {
  byStatus: Array<{ status: string; count: number }>;
  cooling: number;
  toContact: number; // >30gg senza contatto
  totalActive: number;
};

// ---- RF-6.9 Cross-brand flow ("paga chi riceve") ----
// Un voucher emesso dal brand A (issuer) e speso presso il brand B (spendable)
// rappresenta un cliente che il brand A ha "regalato" al brand B. Il costo dello
// sconto grava sullo spendable (chi riceve il nuovo cliente paga la ricompensa).
export type CrossBrandFlow = {
  issuerBrandId: string;
  issuerBrandName: string;
  spendableBrandId: string;
  spendableBrandName: string;
  vouchersIssued: number;
  vouchersRedeemed: number;
  vouchersExpired: number;
  // Costo stimato in centesimi a carico dello spendable (chi paga).
  // Calcolato come:
  //  - reward_kind='valore_fisso' → reward_value_cents direct per redeemed
  //  - reward_kind='percentuale'  → stima su order.total_cents del redeem (join via redeemed_by_order_id)
  //  - reward_kind='servizio_gratis' → non quantificato (contribuisce solo al count)
  estimatedCostCentsRedeemed: number;
  distinctContactsRedeemed: number;
};

export type CrossBrandAnalytics = {
  flows: CrossBrandFlow[];
  // Flussi solo cross-brand (issuer != spendable). Same-brand escluso.
  totalIssuedCrossBrand: number;
  totalRedeemedCrossBrand: number;
  totalEstimatedCostCents: number;
};

// ---- Signup landing ----
export type SignupAnalytics = {
  totalEventsInPeriod: number;
  totalEventsPreviousPeriod: number;
  vouchersEmitted: number;
  byLanding: Array<{
    slug: string;
    headline: string;
    signups: number;
    vouchersEmitted: number;
    conversionPct: number;
  }>;
};
