"use server";

// M01 Data Hub Blocco 2 — server actions per catalogo + pricing.
// Ogni action: requireCapability + ownership check + audit log + revalidatePath.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  getProduct,
} from "./products-repo";
import { recordPriceChange } from "./product-prices-repo";
import type { ProductSource, ProductUnit } from "./catalog-types";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

async function requireOwnedProduct(productId: string, cap: Capability) {
  const session = await requireAuth(cap);
  const product = await getProduct(productId, session.organizationId);
  if (!product) throw new Error("Prodotto non trovato o accesso negato");
  return { session, product };
}

async function requireOwnedBrand(brandId: string, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, organization_id, is_archived")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Marchio non trovato");
  if (data.organization_id !== organizationId) throw new Error("Accesso negato al marchio");
  if (data.is_archived) throw new Error("Marchio archiviato");
  return data as { id: string; slug: string; organization_id: string; is_archived: boolean };
}

// ============================================================================
// Product CRUD (catalog.crud)
// ============================================================================

export type CreateProductActionInput = {
  brandId: string;
  sku: string;
  name: string;
  category: string;
  unit: ProductUnit;
  source: ProductSource;
  priceCents?: number;
  costCents?: number;
  minMarginPct?: number;
  notes?: string;
};

export async function createProductAction(
  input: CreateProductActionInput,
): Promise<{ ok: true; productId: string } | { ok: false; error: string }> {
  const session = await requireAuth("catalog.crud");
  await requireOwnedBrand(input.brandId, session.organizationId);

  if (!input.sku || input.sku.trim().length === 0) {
    return { ok: false, error: "SKU obbligatorio" };
  }
  if (!input.name || input.name.trim().length === 0) {
    return { ok: false, error: "Nome obbligatorio" };
  }

  try {
    const product = await createProduct({
      organizationId: session.organizationId,
      brandId: input.brandId,
      sku: input.sku,
      name: input.name,
      category: input.category,
      unit: input.unit,
      priceCurrentCents: input.priceCents ?? null,
      costCurrentCents: input.costCents ?? null,
      minMarginPct: input.minMarginPct ?? null,
      source: input.source,
      notes: input.notes ?? null,
    });

    // Se hai fornito un prezzo alla creazione, apri anche il primo snapshot storico
    if (input.priceCents !== undefined) {
      await recordPriceChange({
        organizationId: session.organizationId,
        productId: product.id,
        priceCents: input.priceCents,
        costCents: input.costCents ?? null,
        note: "Prezzo iniziale (creazione prodotto)",
        changedBy: session.userId,
      });
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "catalog.product_created",
      target: `brand:${input.brandId}`,
      details: { productId: product.id, sku: product.sku, category: product.category },
    });

    revalidatePath("/catalogo");
    return { ok: true, productId: product.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type UpdateProductActionInput = {
  productId: string;
  patch: {
    sku?: string;
    name?: string;
    category?: string;
    unit?: ProductUnit;
    notes?: string | null;
  };
};

export async function updateProductAction(
  input: UpdateProductActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session } = await requireOwnedProduct(input.productId, "catalog.crud");
  try {
    await updateProduct({
      productId: input.productId,
      organizationId: session.organizationId,
      patch: input.patch,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "catalog.product_updated",
      target: `product:${input.productId}`,
      details: { fields: Object.keys(input.patch) },
    });
    revalidatePath("/catalogo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function archiveProductAction(productId: string): Promise<void> {
  const { session } = await requireOwnedProduct(productId, "catalog.crud");
  const ok = await archiveProduct(productId, session.organizationId);
  if (!ok) throw new Error("Prodotto già archiviato o non trovato");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "catalog.product_archived",
    target: `product:${productId}`,
    details: {},
  });
  revalidatePath("/catalogo");
}

export async function restoreProductAction(productId: string): Promise<void> {
  const { session } = await requireOwnedProduct(productId, "catalog.crud");
  const ok = await restoreProduct(productId, session.organizationId);
  if (!ok) throw new Error("Prodotto non archiviato o non trovato");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "catalog.product_restored",
    target: `product:${productId}`,
    details: {},
  });
  revalidatePath("/catalogo");
}

// ============================================================================
// Pricing (RF-6.11, owner-only via pricing.manage)
// ============================================================================

export type RecordPriceChangeActionInput = {
  productId: string;
  priceCents: number;
  costCents?: number;
  note?: string;
};

export async function recordPriceChangeAction(
  input: RecordPriceChangeActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, product } = await requireOwnedProduct(input.productId, "pricing.manage");

  if (input.priceCents < 0) {
    return { ok: false, error: "Il prezzo non puo essere negativo" };
  }
  if (input.costCents !== undefined && input.costCents < 0) {
    return { ok: false, error: "Il costo non puo essere negativo" };
  }

  try {
    const snapshot = await recordPriceChange({
      organizationId: session.organizationId,
      productId: input.productId,
      priceCents: input.priceCents,
      costCents: input.costCents ?? null,
      note: input.note ?? null,
      changedBy: session.userId,
    });

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "catalog.price_changed",
      target: `product:${input.productId}`,
      details: {
        snapshotId: snapshot.id,
        sku: product.sku,
        priceCents: input.priceCents,
        costCents: input.costCents ?? null,
        previousPriceCents: product.priceCurrentCents,
        note: input.note ?? null,
      },
    });

    revalidatePath("/catalogo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type UpdateMarginActionInput = {
  productId: string;
  minMarginPct: number | null;
};

export async function updateMarginAction(
  input: UpdateMarginActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, product } = await requireOwnedProduct(input.productId, "pricing.manage");

  if (input.minMarginPct !== null) {
    if (input.minMarginPct < 0 || input.minMarginPct > 100) {
      return { ok: false, error: "Margine minimo deve essere tra 0 e 100" };
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    const { error } = await admin
      .from("brand_products")
      .update({ min_margin_pct: input.minMarginPct })
      .eq("id", input.productId)
      .eq("organization_id", session.organizationId);
    if (error) throw new Error(`Errore aggiornamento margine: ${error.message}`);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "catalog.margin_updated",
      target: `product:${input.productId}`,
      details: {
        sku: product.sku,
        newMarginPct: input.minMarginPct,
        previousMarginPct: product.minMarginPct,
      },
    });

    revalidatePath("/catalogo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
