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

// Server actions arriveranno in Task 7.
