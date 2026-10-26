// M08 Reviews - types centrali.

export type ReviewSource = "google";

export type ReviewClassification = "positive" | "negative" | "serious";

export type ReviewStatus =
  | "pending"
  | "draft_ready"
  | "approved"
  | "published_externally"
  | "serious_signaled"
  | "serious_resolved"
  | "ignored";

export type Review = {
  id: string;
  organizationId: string;
  brandId: string;
  source: ReviewSource;
  externalId: string;
  authorName: string | null;
  rating: number;
  textOriginal: string | null;
  postedAt: string;
  fetchedAt: string;
  classification: ReviewClassification;
  classificationReason: string | null;
  suggestedReply: string | null;
  approvedReply: string | null;
  status: ReviewStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedExternallyAt: string | null;
  resolvedNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const CLASSIFICATION_LABELS: Record<ReviewClassification, string> = {
  positive: "Positiva",
  negative: "Negativa",
  serious: "Grave",
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "In attesa bozza",
  draft_ready: "Bozza pronta",
  approved: "Approvata",
  published_externally: "Pubblicata su Google",
  serious_signaled: "Grave segnalata",
  serious_resolved: "Grave risolta",
  ignored: "Ignorata",
};
