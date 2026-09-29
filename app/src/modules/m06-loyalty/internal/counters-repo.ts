// M06 — repo contatori fedeltà.

import { getAdminClient } from "@/lib/db/admin";
import type { LoyaltyCounter, CounterKind, CounterResetMode } from "./loyalty-types";

const SELECT_COLS =
  "id, organization_id, brand_id, name, description, kind, threshold_count, threshold_value_cents, reset_mode, is_active, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCounter(row: any): LoyaltyCounter {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    name: row.name,
    description: row.description ?? null,
    kind: row.kind as CounterKind,
    thresholdCount: row.threshold_count ?? null,
    thresholdValueCents: row.threshold_value_cents ?? null,
    resetMode: row.reset_mode as CounterResetMode,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCounters(
  organizationId: string,
  includeInactive: boolean = false,
): Promise<
  Array<LoyaltyCounter & { brandSlug: string; brandDisplayName: string; brandColor: string }>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("loyalty_counters")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`Errore lista contatori: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    ...rowToCounter(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
}

export async function getCounter(
  counterId: string,
  organizationId: string,
): Promise<LoyaltyCounter | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("loyalty_counters")
    .select(SELECT_COLS)
    .eq("id", counterId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura contatore: ${error.message}`);
  return data ? rowToCounter(data) : null;
}

export type UpsertCounterInput = {
  organizationId: string;
  brandId: string;
  counterId?: string; // se presente = update
  name: string;
  description?: string | null;
  kind: CounterKind;
  thresholdCount?: number | null;
  thresholdValueCents?: number | null;
  resetMode: CounterResetMode;
  isActive: boolean;
};

export async function upsertCounter(input: UpsertCounterInput): Promise<LoyaltyCounter> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    name: input.name.trim(),
    description: input.description ?? null,
    kind: input.kind,
    threshold_count: input.thresholdCount ?? null,
    threshold_value_cents: input.thresholdValueCents ?? null,
    reset_mode: input.resetMode,
    is_active: input.isActive,
  };
  if (input.counterId) {
    const { data, error } = await admin
      .from("loyalty_counters")
      .update(row)
      .eq("id", input.counterId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore update contatore: ${error.message}`);
    return rowToCounter(data);
  } else {
    const { data, error } = await admin
      .from("loyalty_counters")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore insert contatore: ${error.message}`);
    return rowToCounter(data);
  }
}

/**
 * Progresso del contatore per un contatto: aggrega gli eventi dall'ultimo reset
 * (per ora: dal reset_at NULL = sempre dall'inizio; reset logic completa in blocco successivo).
 */
export async function getContactCounterProgress(
  counterId: string,
  contactId: string,
  organizationId: string,
): Promise<{ count: number; valueCents: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("loyalty_counter_events")
    .select("delta_count, delta_value_cents")
    .eq("counter_id", counterId)
    .eq("contact_id", contactId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`Errore progresso contatore: ${error.message}`);
  const rows = (data ?? []) as Array<{ delta_count: number; delta_value_cents: number }>;
  return {
    count: rows.reduce((s, r) => s + Number(r.delta_count ?? 0), 0),
    valueCents: rows.reduce((s, r) => s + Number(r.delta_value_cents ?? 0), 0),
  };
}

export type RecordCounterEventInput = {
  organizationId: string;
  counterId: string;
  contactId: string;
  deltaCount?: number;
  deltaValueCents?: number;
  orderId?: string | null;
  note?: string | null;
};

export async function recordCounterEvent(input: RecordCounterEventInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    counter_id: input.counterId,
    contact_id: input.contactId,
    delta_count: input.deltaCount ?? 1,
    delta_value_cents: input.deltaValueCents ?? 0,
    order_id: input.orderId ?? null,
    note: input.note ?? null,
  };
  const { error } = await admin.from("loyalty_counter_events").insert(row);
  if (error) throw new Error(`Errore registrazione evento contatore: ${error.message}`);
}
