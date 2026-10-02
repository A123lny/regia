// M07 Outreach — types segmentazione + campagne.

export type ConsentChannel = "email" | "sms" | "whatsapp";
export type CampaignChannel = "email" | "sms" | "whatsapp" | "misto";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

/**
 * RF-1.8 Criteri segmentazione. Tutti opzionali, applicati in AND.
 * Se il criterio è undefined, non filtra.
 */
export type SegmentCriteria = {
  /**
   * Almeno un ordine negli ultimi N giorni (recency positiva).
   * Se anche lastOrderMinDays è definito, entrambi devono essere veri (finestra chiusa).
   */
  lastOrderMaxDays?: number;
  /**
   * NESSUN ordine negli ultimi N giorni (dormienti).
   */
  lastOrderMinDays?: number;
  /**
   * Almeno N ordini nella storia del contatto.
   */
  minOrderCount?: number;
  /**
   * Spesa totale (somma total_cents ordini completed/refunded) >= N centesimi.
   */
  minSpentCents?: number;
  /**
   * Deve avere consenso GRANTED su questo canale.
   */
  requiredConsentChannel?: ConsentChannel;
  /**
   * Tag richiesti (AND).
   */
  requiredTags?: string[];
  /**
   * Tag da escludere (NOT).
   */
  excludeTags?: string[];
};

export type ContactSegment = {
  id: string;
  organizationId: string;
  brandId: string;
  name: string;
  description: string | null;
  criteria: SegmentCriteria;
  contactCountMaterialized: number;
  refreshedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Campaign = {
  id: string;
  organizationId: string;
  brandId: string;
  segmentId: string | null;
  contentDraftId: string | null;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  plannedAt: string | null;
  sentAt: string | null;
  attemptedCount: number;
  deliveredCount: number;
  failedCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// UI labels
export const CAMPAIGN_CHANNEL_LABELS: Record<CampaignChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  misto: "Multi-canale",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Bozza",
  scheduled: "Programmata",
  sending: "In invio",
  sent: "Inviata",
  cancelled: "Annullata",
};

export const CONSENT_CHANNEL_LABELS: Record<ConsentChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/**
 * Riepilogo human-readable dei criteri di un segmento.
 */
export function summarizeCriteria(c: SegmentCriteria): string {
  const parts: string[] = [];
  if (c.lastOrderMaxDays !== undefined) parts.push(`ordini ultimi ${c.lastOrderMaxDays}gg`);
  if (c.lastOrderMinDays !== undefined) parts.push(`silenzio ≥${c.lastOrderMinDays}gg`);
  if (c.minOrderCount !== undefined) parts.push(`≥${c.minOrderCount} ordini`);
  if (c.minSpentCents !== undefined) {
    const eur = (c.minSpentCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 0 });
    parts.push(`≥${eur} € spesi`);
  }
  if (c.requiredConsentChannel) parts.push(`consenso ${c.requiredConsentChannel}`);
  if (c.requiredTags && c.requiredTags.length > 0) parts.push(`tag: ${c.requiredTags.join(", ")}`);
  if (c.excludeTags && c.excludeTags.length > 0) parts.push(`escl: ${c.excludeTags.join(", ")}`);
  return parts.length > 0 ? parts.join(" · ") : "Tutti i contatti del marchio";
}
