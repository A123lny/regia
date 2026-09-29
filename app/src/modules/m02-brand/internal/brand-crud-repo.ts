// M02 Brand — Repository CRUD marchi (RF-2.1).
// Query e mutation su public.brands. Tenant-scoped su organization_id (RN-87).
// Slug validato lato DB (constraint brands_slug_format). Colore validato lato DB
// (constraint brands_color_format).

import { getAdminClient } from "@/lib/db/admin";

export type Brand = {
  id: string;
  organizationId: string;
  slug: string;
  displayName: string;
  color: string;
  logoUrl: string | null;
  fontFamily: string;
  emailFromAddress: string | null;
  emailFromDisplayName: string | null;
  emailReplyTo: string | null;
  isArchived: boolean;
  createdAt: string;
};

// Lista chiusa di font Google supportati (validati sia in client che server).
// Se aggiungi qui, ricordati di caricarli in m04-media/internal/templates/font-loader.ts
// per renderli disponibili anche in template PNG.
export const BRAND_FONTS_ALLOWED = [
  "Bricolage",
  "Inter",
  "Playfair Display",
  "Poppins",
  "Roboto",
  "Lora",
  "Montserrat",
  "Merriweather",
] as const;

export type BrandFontFamily = (typeof BRAND_FONTS_ALLOWED)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBrand(row: any): Brand {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    displayName: row.display_name,
    color: row.color,
    logoUrl: row.logo_url ?? null,
    fontFamily: row.font_family ?? "Bricolage",
    emailFromAddress: row.email_from_address ?? null,
    emailFromDisplayName: row.email_from_display_name ?? null,
    emailReplyTo: row.email_reply_to ?? null,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

const SELECT_COLS =
  "id, organization_id, slug, display_name, color, logo_url, font_family, email_from_address, email_from_display_name, email_reply_to, is_archived, created_at";

/**
 * Tenant-scoped list marchi. Filtri mutuamente esclusivi:
 * - "active" (default): solo is_archived=false
 * - "archived": solo is_archived=true (vista cestino)
 * - "all": tutti
 * Ordinati per display_name asc.
 */
export type BrandListFilter = "active" | "archived" | "all";

export async function listBrands(
  organizationId: string,
  filter: BrandListFilter = "active",
): Promise<Brand[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let query = admin
    .from("brands")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .order("display_name");
  if (filter === "active") query = query.eq("is_archived", false);
  else if (filter === "archived") query = query.eq("is_archived", true);
  const { data, error } = await query;
  if (error) throw new Error(`Errore lettura marchi: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToBrand);
}

/**
 * Tenant-scoped fetch by slug. Ritorna null se non esiste.
 * Include archiviati (le UI decidono se filtrare).
 */
export async function getBrandBySlug(organizationId: string, slug: string): Promise<Brand | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Errore fetch marchio: ${error.message}`);
  return data ? rowToBrand(data) : null;
}

/**
 * Tenant-scoped fetch by id. Ritorna null se non esiste o cross-tenant.
 */
export async function getBrandById(organizationId: string, brandId: string): Promise<Brand | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore fetch marchio: ${error.message}`);
  return data ? rowToBrand(data) : null;
}

export type InsertBrandInput = {
  organizationId: string;
  slug: string;
  displayName: string;
  color: string;
};

export async function insertBrand(input: InsertBrandInput): Promise<Brand> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .insert({
      organization_id: input.organizationId,
      slug: input.slug,
      display_name: input.displayName,
      color: input.color,
    })
    .select(SELECT_COLS)
    .single();
  if (error) {
    // 23505 = unique_violation → slug duplicato per org
    if (error.code === "23505") {
      throw new Error(`Slug "${input.slug}" gia usato per un altro marchio`);
    }
    // 23514 = check_violation → formato slug/color non valido
    if (error.code === "23514") {
      throw new Error("Formato slug o colore non valido");
    }
    throw new Error(`Errore inserimento marchio: ${error.message}`);
  }
  return rowToBrand(data);
}

export type UpdateBrandPatch = {
  slug?: string;
  displayName?: string;
  color?: string;
  fontFamily?: BrandFontFamily;
  emailFromAddress?: string | null;
  emailFromDisplayName?: string | null;
  emailReplyTo?: string | null;
};

/**
 * Tenant-scoped patch. Ritorna brand aggiornato o null se non trovato/cross-tenant.
 */
export async function updateBrandRow(
  organizationId: string,
  brandId: string,
  patch: UpdateBrandPatch,
): Promise<Brand | null> {
  const dbPatch: Record<string, string | null> = {};
  if (patch.slug !== undefined) dbPatch["slug"] = patch.slug;
  if (patch.displayName !== undefined) dbPatch["display_name"] = patch.displayName;
  if (patch.color !== undefined) dbPatch["color"] = patch.color;
  if (patch.fontFamily !== undefined) dbPatch["font_family"] = patch.fontFamily;
  if (patch.emailFromAddress !== undefined) dbPatch["email_from_address"] = patch.emailFromAddress;
  if (patch.emailFromDisplayName !== undefined)
    dbPatch["email_from_display_name"] = patch.emailFromDisplayName;
  if (patch.emailReplyTo !== undefined) dbPatch["email_reply_to"] = patch.emailReplyTo;
  if (Object.keys(dbPatch).length === 0) {
    // nulla da aggiornare: ritorno lo stato attuale
    return getBrandById(organizationId, brandId);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .update(dbPatch)
    .eq("organization_id", organizationId)
    .eq("id", brandId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw new Error(`Slug "${patch.slug}" gia usato per un altro marchio`);
    }
    if (error.code === "23514") {
      throw new Error("Formato slug o colore non valido");
    }
    throw new Error(`Errore aggiornamento marchio: ${error.message}`);
  }
  return data ? rowToBrand(data) : null;
}

/**
 * Tenant-scoped: aggiorna il logo_url del marchio (o lo azzera con null).
 */
export async function setBrandLogoUrl(
  organizationId: string,
  brandId: string,
  logoUrl: string | null,
): Promise<Brand | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .update({ logo_url: logoUrl })
    .eq("organization_id", organizationId)
    .eq("id", brandId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore aggiornamento logo: ${error.message}`);
  return data ? rowToBrand(data) : null;
}

/**
 * Tenant-scoped soft delete/restore via is_archived.
 */
export async function setBrandArchived(
  organizationId: string,
  brandId: string,
  archived: boolean,
): Promise<Brand | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .update({ is_archived: archived })
    .eq("organization_id", organizationId)
    .eq("id", brandId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore archiviazione marchio: ${error.message}`);
  return data ? rowToBrand(data) : null;
}
