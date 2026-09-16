// M03 — Types domain per content_drafts.
// Nomi campi in inglese (identificatori codice), etichette UI in italiano.

export type ContentChannel = "social";
// F1.5b+ estenderà con: "email", "whatsapp", "sms", "google".

export type ContentDraftStatus = "draft" | "approved" | "rejected";
// F1.5b aggiungerà: "scheduled", "published", "measured" (RF-3.5 workflow completo).

export type ContentDraft = {
  id: string;
  organizationId: string;
  brandId: string;
  channel: ContentChannel;
  themeInput: string;
  generatedText: string;
  promptVersion: string; // es. "social-post-v1"
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  status: ContentDraftStatus;
  rejectionReason: string | null;
  createdBy: string | null; // null se auth user cancellato (FK on delete set null)
  createdAt: string; // ISO
  approvedAt: string | null;
  rejectedAt: string | null;
};
