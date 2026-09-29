// M04 — Repository media asset (RF-4.1).
// Tenant-scoped su organization_id. Query: list per brand + search per tag/caption.

import { getAdminClient } from "@/lib/db/admin";
import type { MediaAsset, MediaAssetContentType } from "./media-assets-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAsset(row: any): MediaAsset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    storagePath: row.storage_path,
    signedUrl: row.signed_url,
    contentType: row.content_type as MediaAssetContentType,
    sizeBytes: row.size_bytes,
    width: row.width ?? null,
    height: row.height ?? null,
    tags: (row.tags ?? []) as string[],
    caption: row.caption ?? "",
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by ?? null,
  };
}

const SELECT_COLS =
  "id, organization_id, brand_id, storage_path, signed_url, content_type, size_bytes, width, height, tags, caption, uploaded_at, uploaded_by";

/**
 * Tenant-scoped: lista tutti i media di un brand, ordinati per uploaded_at desc.
 */
export async function listMediaAssetsByBrand(
  organizationId: string,
  brandId: string,
  limit: number = 100,
): Promise<MediaAsset[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_media_assets")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lettura media: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToAsset);
}

/**
 * Ricerca per brand con filtro tag (AND) + full-text caption.
 * Se tags vuoto e query vuota, torna lista completa.
 */
export async function searchMediaAssetsByBrand(
  organizationId: string,
  brandId: string,
  filters: { tags?: string[]; query?: string },
  limit: number = 100,
): Promise<MediaAsset[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("brand_media_assets")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId);

  if (filters.tags && filters.tags.length > 0) {
    // contains: tutti i tag richiesti devono essere presenti
    q = q.contains("tags", filters.tags);
  }
  if (filters.query && filters.query.trim().length > 0) {
    // ilike su caption (semplice, sufficiente per volumi previsti)
    q = q.ilike("caption", `%${filters.query.trim()}%`);
  }

  const { data, error } = await q.order("uploaded_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Errore ricerca media: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToAsset);
}

/**
 * Tenant-scoped fetch by id. Ritorna null se non esiste o cross-tenant.
 */
export async function getMediaAssetById(
  organizationId: string,
  assetId: string,
): Promise<MediaAsset | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_media_assets")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(`Errore fetch media: ${error.message}`);
  return data ? rowToAsset(data) : null;
}

export type InsertMediaAssetInput = {
  organizationId: string;
  brandId: string;
  storagePath: string;
  signedUrl: string;
  contentType: MediaAssetContentType;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  tags: string[];
  caption: string;
  uploadedBy: string;
};

export async function insertMediaAsset(input: InsertMediaAssetInput): Promise<MediaAsset> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_media_assets")
    .insert({
      organization_id: input.organizationId,
      brand_id: input.brandId,
      storage_path: input.storagePath,
      signed_url: input.signedUrl,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      tags: input.tags,
      caption: input.caption,
      uploaded_by: input.uploadedBy,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore insert media: ${error.message}`);
  return rowToAsset(data);
}

/**
 * Tenant-scoped update: caption + tags. Ritorna asset aggiornato o null.
 */
export async function updateMediaAssetMeta(
  organizationId: string,
  assetId: string,
  patch: { caption?: string; tags?: string[] },
): Promise<MediaAsset | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.caption !== undefined) dbPatch["caption"] = patch.caption;
  if (patch.tags !== undefined) dbPatch["tags"] = patch.tags;
  if (Object.keys(dbPatch).length === 0) return getMediaAssetById(organizationId, assetId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_media_assets")
    .update(dbPatch)
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore update media: ${error.message}`);
  return data ? rowToAsset(data) : null;
}

export async function deleteMediaAssetRow(
  organizationId: string,
  assetId: string,
): Promise<{ storagePath: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: existing } = await admin
    .from("brand_media_assets")
    .select("storage_path")
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .maybeSingle();
  if (!existing) return null;
  const { error } = await admin
    .from("brand_media_assets")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", assetId);
  if (error) throw new Error(`Errore delete media: ${error.message}`);
  return { storagePath: (existing as { storage_path: string }).storage_path };
}

/**
 * Set/reset media_asset_id di un draft (allegare o staccare immagine).
 * Verifica tenant scoping su draft e (se assetId non null) su asset.
 */
export async function setDraftMediaAsset(
  organizationId: string,
  draftId: string,
  assetId: string | null,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  if (assetId !== null) {
    // Verifica che asset appartenga alla stessa org
    const asset = await getMediaAssetById(organizationId, assetId);
    if (!asset) throw new Error("Media asset non trovato");
  }
  const { error, count } = await admin
    .from("content_drafts")
    .update({ media_asset_id: assetId }, { count: "exact" })
    .eq("id", draftId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`Errore aggancio asset a draft: ${error.message}`);
  return (count ?? 0) > 0;
}
