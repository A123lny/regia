// M07 — repo segmenti.

import { getAdminClient } from "@/lib/db/admin";
import type { ContactSegment, SegmentCriteria } from "./outreach-types";
import { countMatchingContacts } from "./segment-evaluator";

const SELECT_COLS =
  "id, organization_id, brand_id, name, description, criteria, contact_count_materialized, refreshed_at, is_active, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSegment(row: any): ContactSegment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    name: row.name,
    description: row.description ?? null,
    criteria: (row.criteria ?? {}) as SegmentCriteria,
    contactCountMaterialized: row.contact_count_materialized,
    refreshedAt: row.refreshed_at ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SegmentRow = ContactSegment & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

export async function listSegments(
  organizationId: string,
  includeInactive: boolean = false,
): Promise<SegmentRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("contact_segments")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`Errore lista segmenti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): SegmentRow => ({
    ...rowToSegment(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
}

export async function getSegment(
  segmentId: string,
  organizationId: string,
): Promise<ContactSegment | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contact_segments")
    .select(SELECT_COLS)
    .eq("id", segmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura segmento: ${error.message}`);
  return data ? rowToSegment(data) : null;
}

export type UpsertSegmentInput = {
  organizationId: string;
  segmentId?: string;
  brandId: string;
  name: string;
  description?: string | null;
  criteria: SegmentCriteria;
  isActive: boolean;
};

export async function upsertSegment(input: UpsertSegmentInput): Promise<ContactSegment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Calcola count al momento del salvataggio (RF-1.8)
  const count = await countMatchingContacts(input.organizationId, input.brandId, input.criteria);

  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    name: input.name.trim(),
    description: input.description ?? null,
    criteria: input.criteria,
    contact_count_materialized: count,
    refreshed_at: new Date().toISOString(),
    is_active: input.isActive,
  };

  if (input.segmentId) {
    const { data, error } = await admin
      .from("contact_segments")
      .update(row)
      .eq("id", input.segmentId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore update segmento: ${error.message}`);
    return rowToSegment(data);
  } else {
    const { data, error } = await admin
      .from("contact_segments")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore insert segmento: ${error.message}`);
    return rowToSegment(data);
  }
}

/**
 * Ricalcola il count materializzato di un segmento esistente.
 */
export async function refreshSegmentCount(
  segmentId: string,
  organizationId: string,
): Promise<ContactSegment | null> {
  const seg = await getSegment(segmentId, organizationId);
  if (!seg) return null;
  const count = await countMatchingContacts(organizationId, seg.brandId, seg.criteria);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contact_segments")
    .update({
      contact_count_materialized: count,
      refreshed_at: new Date().toISOString(),
    })
    .eq("id", segmentId)
    .eq("organization_id", organizationId)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore refresh segmento: ${error.message}`);
  return rowToSegment(data);
}
