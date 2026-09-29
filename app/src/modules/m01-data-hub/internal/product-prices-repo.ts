// M01 Data Hub Blocco 2 — storico prezzi/costi (RF-1.5, append-only).
// Ogni cambio chiude il record aperto (valid_to = now) e ne apre uno nuovo.
// UNIQUE parziale in DB garantisce un solo record aperto per prodotto.

import { getAdminClient } from "@/lib/db/admin";
import type { ProductPriceSnapshot } from "./catalog-types";

const SELECT_COLS =
  "id, organization_id, product_id, price_cents, cost_cents, valid_from, valid_to, note, changed_by, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPrice(row: any): ProductPriceSnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    priceCents: row.price_cents,
    costCents: row.cost_cents ?? null,
    validFrom: row.valid_from,
    validTo: row.valid_to ?? null,
    note: row.note ?? null,
    changedBy: row.changed_by ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Timeline completa per un prodotto, dal più recente al più vecchio.
 */
export async function listPriceHistoryByProduct(
  productId: string,
  organizationId: string,
): Promise<ProductPriceSnapshot[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_product_prices")
    .select(SELECT_COLS)
    .eq("product_id", productId)
    .eq("organization_id", organizationId)
    .order("valid_from", { ascending: false });
  if (error) throw new Error(`Errore lettura storico prezzi: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToPrice);
}

export type RecordPriceChangeInput = {
  organizationId: string;
  productId: string;
  priceCents: number;
  costCents?: number | null;
  note?: string | null;
  changedBy?: string | null;
  validFromIso?: string;
};

/**
 * Registra un cambio prezzo/costo. Chiude il record precedente aperto e ne apre uno nuovo.
 * Aggiorna anche `brand_products.price_current_cents` / `cost_current_cents` come cache.
 * Atomico: se una delle due update fallisce, l'altra viene rollback (in una transazione
 * lato Supabase JS non è disponibile — usiamo la strategia "close first, insert second"
 * e affidiamo a UNIQUE parziale la protezione contro double-open).
 */
export async function recordPriceChange(
  input: RecordPriceChangeInput,
): Promise<ProductPriceSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = input.validFromIso ?? new Date().toISOString();

  // 1) Chiudo il record aperto (se presente)
  const { error: closeErr } = await admin
    .from("brand_product_prices")
    .update({ valid_to: now })
    .eq("product_id", input.productId)
    .eq("organization_id", input.organizationId)
    .is("valid_to", null);
  if (closeErr) throw new Error(`Errore chiusura prezzo precedente: ${closeErr.message}`);

  // 2) Inserisco nuovo record aperto
  const insertRow: Record<string, unknown> = {
    organization_id: input.organizationId,
    product_id: input.productId,
    price_cents: input.priceCents,
    cost_cents: input.costCents ?? null,
    valid_from: now,
    valid_to: null,
    note: input.note ?? null,
    changed_by: input.changedBy ?? null,
  };
  const { data, error } = await admin
    .from("brand_product_prices")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore inserimento prezzo: ${error.message}`);

  // 3) Aggiorna cache sul prodotto
  await admin
    .from("brand_products")
    .update({
      price_current_cents: input.priceCents,
      cost_current_cents: input.costCents ?? null,
    })
    .eq("id", input.productId)
    .eq("organization_id", input.organizationId);

  return rowToPrice(data);
}
