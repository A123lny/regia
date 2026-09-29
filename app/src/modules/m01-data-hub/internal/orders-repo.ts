// M01 Data Hub Blocco 2 — repo ordini/vendite.
// Tenant-scoped. In F1 solo query; scrittura arriva col sync gestionali (RF-1.6).
// Il totale è mantenuto coerente in DB dal trigger su brand_order_lines.

import { getAdminClient } from "@/lib/db/admin";
import type { BrandOrder, OrderChannel, OrderLine, OrderStatus } from "./catalog-types";

const ORDER_COLS =
  "id, organization_id, brand_id, contact_id, external_ref, channel, status, " +
  "total_cents, currency, placed_at, completed_at, notes, created_at, updated_at";

const LINE_COLS =
  "id, order_id, product_id, name_snapshot, unit_price_cents, quantity, line_total_cents, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOrder(row: any): BrandOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    contactId: row.contact_id ?? null,
    externalRef: row.external_ref ?? null,
    channel: row.channel as OrderChannel,
    status: row.status as OrderStatus,
    totalCents: row.total_cents,
    currency: row.currency,
    placedAt: row.placed_at,
    completedAt: row.completed_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLine(row: any): OrderLine {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id ?? null,
    nameSnapshot: row.name_snapshot,
    unitPriceCents: row.unit_price_cents,
    quantity: Number(row.quantity),
    lineTotalCents: row.line_total_cents,
    createdAt: row.created_at,
  };
}

export type ListOrdersInput = {
  organizationId: string;
  brandId?: string;
  contactId?: string;
  channel?: OrderChannel;
  status?: OrderStatus;
  fromIso?: string;
  toIso?: string;
  limit?: number;
  offset?: number;
};

export type OrderRow = BrandOrder & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  contactFullName: string | null;
};

export type ListOrdersResult = {
  items: OrderRow[];
  totalCount: number;
};

export async function listOrders(input: ListOrdersInput): Promise<ListOrdersResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("brand_orders")
    .select(
      `${ORDER_COLS}, brands!inner(slug, display_name, color, is_archived), contacts(first_name, last_name)`,
      { count: "exact" },
    )
    .eq("organization_id", input.organizationId)
    .eq("brands.is_archived", false);

  if (input.brandId) q = q.eq("brand_id", input.brandId);
  if (input.contactId) q = q.eq("contact_id", input.contactId);
  if (input.channel) q = q.eq("channel", input.channel);
  if (input.status) q = q.eq("status", input.status);
  if (input.fromIso) q = q.gte("placed_at", input.fromIso);
  if (input.toIso) q = q.lte("placed_at", input.toIso);

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  q = q.order("placed_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`Errore lista ordini: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((data ?? []) as any[]).map((row): OrderRow => {
    const first = row.contacts?.first_name as string | null | undefined;
    const last = row.contacts?.last_name as string | null | undefined;
    const parts = [first, last].filter((v): v is string => Boolean(v));
    return {
      ...rowToOrder(row),
      brandSlug: row.brands.slug as string,
      brandDisplayName: row.brands.display_name as string,
      brandColor: row.brands.color as string,
      contactFullName: parts.length > 0 ? parts.join(" ") : null,
    };
  });

  return { items, totalCount: count ?? items.length };
}

export async function getOrder(
  orderId: string,
  organizationId: string,
): Promise<BrandOrder | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_orders")
    .select(ORDER_COLS)
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura ordine: ${error.message}`);
  return data ? rowToOrder(data) : null;
}

export async function listOrderLines(orderId: string): Promise<OrderLine[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_order_lines")
    .select(LINE_COLS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Errore lettura righe ordine: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToLine);
}

/**
 * Statistiche sintetiche per header pagina.
 */
export async function getOrdersStats(organizationId: string): Promise<{
  total: number;
  totalThisMonth: number;
  totalCentsThisMonth: number;
  completedThisMonth: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [totalRes, monthRes, completedRes] = await Promise.all([
    admin
      .from("brand_orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    admin
      .from("brand_orders")
      .select("total_cents")
      .eq("organization_id", organizationId)
      .gte("placed_at", startOfMonth),
    admin
      .from("brand_orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .gte("placed_at", startOfMonth),
  ]);

  if (totalRes.error) throw new Error(`Errore conteggio ordini: ${totalRes.error.message}`);
  if (monthRes.error) throw new Error(`Errore somma mese: ${monthRes.error.message}`);
  if (completedRes.error)
    throw new Error(`Errore conteggio completati: ${completedRes.error.message}`);

  const rows = (monthRes.data ?? []) as Array<{ total_cents: number }>;
  const totalCentsThisMonth = rows.reduce((s, r) => s + Number(r.total_cents ?? 0), 0);

  return {
    total: totalRes.count ?? 0,
    totalThisMonth: rows.length,
    totalCentsThisMonth,
    completedThisMonth: completedRes.count ?? 0,
  };
}
