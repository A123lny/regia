// M02 — Marchi e identità. Interfaccia pubblica (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

export type {
  BrandKit,
  BrandPillar,
  BrandForbiddenWord,
  BrandSensitiveTopic,
  BrandKitWithLists,
  SensitiveTopicKind,
} from "./internal/brand-kit-types";

// Query (server components)
export { getBrandKitWithLists, formatBrandContextForAI } from "./internal/brand-kit-repo";
export {
  listBrands,
  getBrandBySlug,
  getBrandById,
  BRAND_FONTS_ALLOWED,
} from "./internal/brand-crud-repo";
export type { Brand, BrandListFilter, BrandFontFamily } from "./internal/brand-crud-repo";

// Server actions (form submit)
export {
  updateBrandKitTone,
  updateBrandKitContext,
  addBrandPillar,
  removeBrandPillar,
  moveBrandPillar,
  addBrandForbiddenWord,
  removeBrandForbiddenWord,
  addBrandSensitiveTopic,
  removeBrandSensitiveTopic,
} from "./internal/brand-kit-actions";
export {
  createBrand,
  updateBrand,
  archiveBrand,
  restoreBrand,
  uploadBrandLogo,
  removeBrandLogo,
} from "./internal/brand-crud-actions";

// Social account CRUD (predisposizione M14 auto-publishing)
export { listBrandSocialAccounts } from "./internal/brand-social-repo";
export {
  saveBrandSocialAccount,
  disconnectBrandSocialAccount,
} from "./internal/brand-social-actions";
export {
  SOCIAL_PLATFORMS,
  getSchema as getSocialPlatformSchema,
} from "./internal/brand-social-types";
export type {
  SocialPlatform,
  SocialPlatformSchema,
  SocialFieldSchema,
  BrandSocialAccount,
} from "./internal/brand-social-types";
