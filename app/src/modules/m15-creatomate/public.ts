// M15 Creatomate — interfaccia pubblica (RS-1).
// Ogni altro modulo importa SOLO da qui, mai da ./internal/.

export {
  listRecentRendersByBrand,
  getRenderById,
  getRenderByExternalId,
  updateRenderStatus,
} from "./internal/creatomate-renders-repo";
export type {
  CreatomateRenderRow,
  CreatomateRenderStatus,
} from "./internal/creatomate-renders-repo";

export {
  listBrandTemplates,
  upsertBrandTemplate,
  removeBrandTemplate,
} from "./internal/brand-templates-repo";
export type { BrandCreatomateTemplate } from "./internal/brand-templates-repo";

export {
  upsertBrandTemplateAction,
  removeBrandTemplateAction,
} from "./internal/brand-templates-actions";

export {
  startCreatomateRender,
  getCreatomateRenderStatus,
  applySucceededRender,
} from "./internal/render-actions";
export type { StartRenderResult, RenderStatusResult } from "./internal/render-actions";

export { prefillModifications, splitDraftText } from "./internal/prefill";

export {
  CREATOMATE_PROVIDER_SLUG,
  CREATOMATE_USD_PER_CREDIT,
  CREATOMATE_PRESETS,
} from "@/lib/creatomate/config";
export type { CreatomateRenderQuality } from "@/lib/creatomate/config";

export { isCreatomateKeyPresent } from "@/lib/creatomate/client";
