// M15 Creatomate — barrel CLIENT-SAFE (RS-1 split).
// I client components importano SOLO da qui. Funzioni server-only
// (es. applySucceededRenderByExternalId con "server-only") stanno in ./server.ts.
//
// IMPORTANTE: NON re-esportare da qui file che contengono `import "server-only"`
// (vale anche per cascata transitiva). Altrimenti il build Next fallisce con:
//   "'server-only' cannot be imported from a Client Component module"
// quando un client component importa qualunque simbolo di questo barrel.

export {
  listRecentRendersByBrand,
  getRenderById,
  getRenderByExternalId,
  updateRenderStatus,
  insertCreatomateRender,
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
  startCreatomateDefaultRender,
  getCreatomateRenderStatus,
} from "./internal/render-actions";
export type { StartRenderResult, RenderStatusResult } from "./internal/render-actions";

export { DEFAULT_VARIANT_LABELS } from "./internal/default-sources";
export type { DefaultVariant } from "./internal/default-sources";

// applySucceededRenderByExternalId è server-only (import "server-only").
// Vive in ./server.ts per non spezzare il bundle client.

export { prefillModifications, splitDraftText } from "./internal/prefill";

export {
  CREATOMATE_PROVIDER_SLUG,
  CREATOMATE_USD_PER_CREDIT,
  CREATOMATE_PRESETS,
  isCreatomateKeyPresent,
} from "@/lib/creatomate/config";
export type { CreatomateRenderQuality } from "@/lib/creatomate/config";
