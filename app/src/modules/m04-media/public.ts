// M04 — Media. Interfaccia pubblica (RS-1).
// Libreria media per marchio: upload, tag, ricerca, allegato ai draft (RF-4.1).

export type {
  MediaAsset,
  MediaAssetContentType,
  UploadMediaInput,
} from "./internal/media-assets-types";

export {
  listMediaAssetsByBrand,
  searchMediaAssetsByBrand,
  getMediaAssetById,
  insertMediaAsset,
  setDraftMediaAsset,
} from "./internal/media-assets-repo";

export {
  uploadMediaAsset,
  deleteMediaAsset,
  updateMediaAssetCaption,
  updateMediaAssetTags,
  attachMediaAssetToDraft,
  detachMediaAssetFromDraft,
  generateFromTemplate,
} from "./internal/media-assets-actions";

export {
  TEMPLATE_DEFINITIONS,
  listTemplatesForBrand,
  getTemplateDefinition,
} from "./internal/templates/template-registry";
export type {
  TemplateDefinition,
  TemplateFieldDef,
  TemplateFormat,
} from "./internal/templates/template-types";

// RF-4.2 suggestion + autofill (deterministico, no AI)
export { suggestTemplateForDraft, autofillTemplateFields } from "./internal/templates/suggest";

// RF-4.3 provider media esterna (ToS/diritti verificati)
export {
  listMediaProviders,
  hasActiveProviderForUse,
  PROVIDER_KIND_LABELS,
  RIGHTS_HOLDER_LABELS,
  RIGHTS_HOLDER_HINTS,
  ALLOWED_USE_LABELS,
} from "./internal/media-providers-repo";
export type {
  MediaProvider,
  ProviderKind,
  RightsHolder,
  AllowedUse,
} from "./internal/media-providers-repo";
export {
  upsertMediaProviderAction,
  archiveMediaProviderAction,
} from "./internal/media-providers-actions";
export type { UpsertMediaProviderActionInput } from "./internal/media-providers-actions";

// Generazione immagini AI (fal.ai).
export { generateAiPreviews, generateAndSaveAiVariant } from "./internal/fal-actions";
export type { AiPreviewItem, AiPreviewsResult, AiVariantSavedResult } from "./internal/fal-actions";

// Generazione video AI (fal.ai image-to-video).
export {
  startFalVideoAction,
  getFalVideoJobStatusAction,
} from "./internal/fal-video-actions";
export type { StartVideoResult, VideoStatusResult } from "./internal/fal-video-actions";

// Helper per diagnostica (test rendering template senza bucket).
export { renderTemplateToPng } from "./internal/templates/renderer";

export {
  FAL_PREVIEW_MODEL,
  FAL_QUALITY_MODEL,
  FAL_PROVIDER_SLUG,
  FAL_SIZE_BY_CHANNEL,
} from "@/lib/ai/fal-config";
export type { DraftChannelHint, FalImageModelId } from "@/lib/ai/fal-config";
