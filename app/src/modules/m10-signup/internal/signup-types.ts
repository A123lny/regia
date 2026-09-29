// M10 Signup — types raccolta contatti.

export type AudienceKind = "residente" | "pendolare" | "turista" | "altro";
export type ConsentChannel = "email" | "sms" | "whatsapp";
export type SignupSourceHint = "qr" | "link" | "manuale" | "web";

export type SignupLanding = {
  id: string;
  organizationId: string;
  brandId: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  benefitHeadline: string;
  audiencePrompt: string | null;
  audienceResidenteLabel: string;
  audienceTuristaLabel: string;
  welcomeOfferId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SignupEvent = {
  id: string;
  organizationId: string;
  landingId: string | null;
  contactId: string | null;
  audienceKind: AudienceKind | null;
  channelsGranted: ConsentChannel[];
  welcomeVoucherId: string | null;
  sourceHint: SignupSourceHint;
  ipHash: string | null;
  occurredAt: string;
  createdAt: string;
};

// UI labels
export const AUDIENCE_KIND_LABELS: Record<AudienceKind, string> = {
  residente: "Residente",
  pendolare: "Pendolare",
  turista: "Turista",
  altro: "Altro",
};

export const CONSENT_CHANNEL_LABELS: Record<ConsentChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export const SIGNUP_SOURCE_LABELS: Record<SignupSourceHint, string> = {
  qr: "QR code",
  link: "Link diretto",
  manuale: "Inserimento manuale",
  web: "Web",
};
