// Filtro marchio globale. Persistito in cookie `regia_brand`, override via
// query ?marchio=<slug>. Usato da tutte le pagine per filtrare per marchio.
// `null` = tutti i marchi.

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/db/admin";

export const BRAND_FILTER_COOKIE = "regia_brand";
export const ALL_BRANDS = "all" as const;

export type BrandFilter = string | null;

/**
 * Risolve il brand filter corrente (slug). Query ?marchio= ha precedenza sul cookie.
 */
export async function getBrandFilter(
  searchParamsOrQuery?: { marchio?: string | string[] | undefined } | null,
): Promise<BrandFilter> {
  const raw = searchParamsOrQuery?.marchio;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromQuery === "string" && fromQuery.length > 0) {
    return fromQuery === ALL_BRANDS ? null : fromQuery;
  }
  const jar = await cookies();
  const c = jar.get(BRAND_FILTER_COOKIE)?.value;
  if (!c || c === ALL_BRANDS) return null;
  return c;
}

/**
 * Risolve lo slug corrente nell'UUID brand per il filtro delle query.
 * Ritorna null se nessun filtro attivo o slug non trovato nell'org.
 */
export async function getBrandFilterId(
  organizationId: string,
  searchParamsOrQuery?: { marchio?: string | string[] | undefined } | null,
): Promise<string | null> {
  const slug = await getBrandFilter(searchParamsOrQuery);
  if (!slug) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin
    .from("brands")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("slug", slug)
    .eq("is_archived", false)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
