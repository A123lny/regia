// Filtro marchio globale. Persistito in cookie `regia_brand`, override via
// query ?marchio=<slug>. Usato da tutte le pagine per filtrare per marchio.
// `null` = tutti i marchi.

import { cookies } from "next/headers";

export const BRAND_FILTER_COOKIE = "regia_brand";
export const ALL_BRANDS = "all" as const;

export type BrandFilter = string | null;

/**
 * Risolve il brand filter corrente (query ?marchio= ha precedenza sul cookie).
 * Chiamare da server component o server action.
 */
export async function getBrandFilter(
  searchParamsOrQuery?: { marchio?: string | string[] | undefined } | null,
): Promise<BrandFilter> {
  // 1) query param ha precedenza
  const raw = searchParamsOrQuery?.marchio;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromQuery === "string" && fromQuery.length > 0) {
    return fromQuery === ALL_BRANDS ? null : fromQuery;
  }
  // 2) cookie fallback
  const jar = await cookies();
  const c = jar.get(BRAND_FILTER_COOKIE)?.value;
  if (!c || c === ALL_BRANDS) return null;
  return c;
}
