// M01 Data Hub Blocco 2 — repo prodotti/servizi (RS-2 via getAdminClient).
// Tenant-scoped su organization_id (RN-87).

import { getAdminClient } from "@/lib/db/admin";
import type { BrandProduct, ProductSource, ProductUnit } from "./catalog-types";

const SELECT_COLS =
  "id, organization_id, brand_id, sku, name, category, unit, " +
  "price_current_cents, cost_current_cents, min_margin_pct, source, notes, " +
  "archived_at, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(row: any): BrandProduct {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit as ProductUnit,
    priceCurrentCents: row.price_current_cents ?? null,
    costCurrentCents: row.cost_current_cents ?? null,
    minMarginPct: row.min_margin_pct !== null ? Number(row.min_margin_pct) : null,
    source: row.source as ProductSource,
    notes: row.notes ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ListProductsInput = {
  organizationId: string;
  brandId?: string;
  category?: string;
  source?: ProductSource;
  query?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
};

export type ListProductsResult = {
  items: Array<BrandProduct & { brandSlug: string; brandDisplayName: string; brandColor: string }>;
  totalCount: number;
};

export async function listProducts(input: ListProductsInput): Promise<ListProductsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("brand_products")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`, {
      count: "exact",
    })
    .eq("organization_id", input.organizationId)
    .eq("brands.is_archived", false);

  if (!input.includeArchived) q = q.is("archived_at", null);
  if (input.brandId) q = q.eq("brand_id", input.brandId);
  if (input.category) q = q.eq("category", input.category);
  if (input.source) q = q.eq("source", input.source);

  if (input.query && input.query.trim().length > 0) {
    const term = `%${input.query.trim()}%`;
    q = q.or(`sku.ilike.${term},name.ilike.${term},category.ilike.${term}`);
  }

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  q = q
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`Errore lista prodotti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((data ?? []) as any[]).map((row) => ({
    ...rowToProduct(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
  return { items, totalCount: count ?? items.length };
}

export async function getProduct(
  productId: string,
  organizationId: string,
): Promise<BrandProduct | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_products")
    .select(SELECT_COLS)
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura prodotto: ${error.message}`);
  return data ? rowToProduct(data) : null;
}

export type CreateProductInput = {
  organizationId: string;
  brandId: string;
  sku: string;
  name: string;
  category: string;
  unit: ProductUnit;
  priceCurrentCents?: number | null;
  costCurrentCents?: number | null;
  minMarginPct?: number | null;
  source: ProductSource;
  notes?: string | null;
};

export async function createProduct(input: CreateProductInput): Promise<BrandProduct> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const insertRow: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    sku: input.sku.trim(),
    name: input.name.trim(),
    category: input.category.trim(),
    unit: input.unit,
    price_current_cents: input.priceCurrentCents ?? null,
    cost_current_cents: input.costCurrentCents ?? null,
    min_margin_pct: input.minMarginPct ?? null,
    source: input.source,
    notes: input.notes ?? null,
  };
  const { data, error } = await admin
    .from("brand_products")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore creazione prodotto: ${error.message}`);
  return rowToProduct(data);
}

export type UpdateProductInput = {
  productId: string;
  organizationId: string;
  patch: Partial<Omit<CreateProductInput, "organizationId" | "brandId" | "source">>;
};

export async function updateProduct(input: UpdateProductInput): Promise<BrandProduct | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {};
  if (input.patch.sku !== undefined) patch["sku"] = input.patch.sku.trim();
  if (input.patch.name !== undefined) patch["name"] = input.patch.name.trim();
  if (input.patch.category !== undefined) patch["category"] = input.patch.category.trim();
  if (input.patch.unit !== undefined) patch["unit"] = input.patch.unit;
  if (input.patch.priceCurrentCents !== undefined)
    patch["price_current_cents"] = input.patch.priceCurrentCents;
  if (input.patch.costCurrentCents !== undefined)
    patch["cost_current_cents"] = input.patch.costCurrentCents;
  if (input.patch.minMarginPct !== undefined) patch["min_margin_pct"] = input.patch.minMarginPct;
  if (input.patch.notes !== undefined) patch["notes"] = input.patch.notes;

  if (Object.keys(patch).length === 0) return getProduct(input.productId, input.organizationId);

  const { data, error } = await admin
    .from("brand_products")
    .update(patch)
    .eq("id", input.productId)
    .eq("organization_id", input.organizationId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore aggiornamento prodotto: ${error.message}`);
  return data ? rowToProduct(data) : null;
}

export async function archiveProduct(productId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("brand_products")
    .update({ archived_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) throw new Error(`Errore archiviazione prodotto: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function restoreProduct(productId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("brand_products")
    .update({ archived_at: null }, { count: "exact" })
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .not("archived_at", "is", null);
  if (error) throw new Error(`Errore ripristino prodotto: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Lista categorie distinte per un'org (utile per il select filtro).
 */
export async function listProductCategories(organizationId: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_products")
    .select("category")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) throw new Error(`Errore lettura categorie: ${error.message}`);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ category: string }>) {
    set.add(r.category);
  }
  return Array.from(set).sort();
}
