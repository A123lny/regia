// M03 — Motore editoriale. Interfaccia pubblica (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

// Types
export type {
  ContentDraft,
  ContentDraftStatus,
  ContentChannel,
} from "./internal/content-drafts-types";

// Query (server components / RSC)
export {
  listContentDraftsByBrand,
  getContentDraft,
  listScheduledByBrandBetween,
  listApprovedNotScheduledByBrand,
  getContentDraftsDashboardCounts,
  listContentDraftsByStatus,
  listScheduledByOrgBetween,
  listByOrgOnDay,
  listDraftsByPlanBatch,
  searchArchive,
} from "./internal/content-drafts-repo";
export type { ArchiveSearchInput } from "./internal/content-drafts-repo";

export { listUpcomingRecurrences, listAllRecurrences } from "./internal/recurring-events-repo";
export type {
  UpcomingRecurrence,
  RecurringEvent,
  RecurringEventKind,
} from "./internal/recurring-events-repo";

export {
  createRecurrence,
  updateRecurrence,
  deleteRecurrence,
} from "./internal/recurring-events-actions";

export { listPendingDraftsForSession } from "./internal/session-repo";
export type { SessionDraft } from "./internal/session-repo";

export { computeEditorialBalance } from "./internal/editorial-balance";
export type { EditorialBalance } from "./internal/editorial-balance";

// RF-12.2 topic_label
export { TOPIC_LABELS, TOPIC_LABEL_UI, classifyTopicLabel } from "./internal/topic-classifier";
export type { TopicLabel } from "./internal/topic-classifier";

// RN-85 UTM tagger — link auto-marcati in pubblicazione
export { applyUtmToLinks, extractUrls, tagUrl, composeUtmForDraft } from "./internal/utm-tagger";
export type { UtmParams } from "./internal/utm-tagger";

// RF-13.7 Suggerimenti SEO organica (analyzer euristico, zero costo)
export { analyzeSeoHints, countBySeverity } from "./internal/seo-hints";
export type { SeoHint, SeoHintSeverity } from "./internal/seo-hints";

export {
  listOpenMaterialRequests,
  createMaterialRequest,
  fulfillMaterialRequest,
  cancelMaterialRequest,
} from "./internal/material-requests";
export type { MaterialRequest, MaterialRequestStatus } from "./internal/material-requests";

// Server actions (form submit)
export {
  generateSocialPost,
  approveContentDraft,
  rejectContentDraft,
  scheduleContentDraft,
  unscheduleContentDraft,
  markContentDraftPublished,
  rescheduleContentDraft,
  deleteContentDraft,
  generateEditorialPlan,
  generateServiceCommunication,
  generateRecurrenceDraft,
  updateContentDraftTopicLabel,
} from "./internal/actions";
export type { PlanGenerationActionInput } from "./internal/actions";
