// M01 Data Hub — types domain contatto-centrici.
// Identificatori in inglese, etichette UI in italiano.

export type ContactSource = "qr" | "manuale" | "import" | "gestionale" | "web";
export type ConsentChannel = "email" | "sms" | "whatsapp";
export type ConsentStatus = "granted" | "revoked" | "never";
export type ConsentSource = "qr" | "manuale" | "import" | "gestionale" | "web" | "disiscrizione";
export type VehicleTireType = "estive" | "invernali" | "4stagioni" | "termiche";

export type Contact = {
  id: string;
  organizationId: string;
  brandId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressCap: string | null;
  tags: string[];
  notes: string | null;
  source: ContactSource;
  isDuplicateOf: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactConsent = {
  id: string;
  organizationId: string;
  contactId: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  grantedAt: string | null;
  revokedAt: string | null;
  source: ConsentSource;
  evidenceText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactVehicle = {
  id: string;
  organizationId: string;
  contactId: string;
  plate: string;
  model: string | null;
  year: number | null;
  kilometers: number | null;
  lastServiceAt: string | null; // ISO date (YYYY-MM-DD)
  tireType: VehicleTireType | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// UI helpers
export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  qr: "QR colonnina",
  manuale: "Inserimento manuale",
  import: "Import massivo",
  gestionale: "Gestionale aziendale",
  web: "Web app / sito",
};

export const CONSENT_CHANNEL_LABELS: Record<ConsentChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  granted: "Consenso attivo",
  revoked: "Disiscritto",
  never: "Mai consentito",
};

export const TIRE_TYPE_LABELS: Record<VehicleTireType, string> = {
  estive: "Estive",
  invernali: "Invernali",
  "4stagioni": "4 stagioni",
  termiche: "Termiche",
};
