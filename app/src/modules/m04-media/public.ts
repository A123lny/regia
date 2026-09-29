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
