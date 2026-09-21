// M03 — Types domain per content_drafts.
// Nomi campi in inglese (identificatori codice), etichette UI in italiano.

export type ContentChannel = "social";
// F1.5b+ estenderà con: "email", "whatsapp", "sms", "google".

export type ContentDraftStatus = "draft" | "approved" | "rejected" | "scheduled" | "published";
// F1.5b-α aggiunge "scheduled" + "published" (RF-3.5 workflow).
// F1.5c+ potrà aggiungere "measured" quando M9 sarà in linea.

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
  scheduledAt: string | null; // ISO — null se non programmato (F1.5b-α)
  publishedAt: string | null; // ISO — null se non pubblicato (F1.5b-α)
  imageUrl: string | null; // path Supabase Storage, es. "{orgId}/{draftId}.jpg" (M4-γ)
  imagePrompt: string | null; // prompt inglese usato per FLUX (M4-γ)
  imageModel: string | null; // "flux-dev" o "flux-schnell" (M4-γ)
  imageCostUsd: number | null; // costo call fal.ai (M4-γ)
  imageGeneratedAt: string | null; // ISO timestamp (M4-γ)
};
