// M13 — repo regole autonomia.

import { getAdminClient } from "@/lib/db/admin";
import type { AutonomyLevel, AutonomyRule } from "./governance-types";

const SELECT_COLS =
  "id, organization_id, kind, title, description, level, enforced_in_code, reference_ids, updated_by, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRule(row: any): AutonomyRule {
  return {
    id: row.id,
    organizationId: row.organization_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    level: row.level as AutonomyLevel,
    enforcedInCode: row.enforced_in_code,
    referenceIds: (row.reference_ids ?? []) as string[],
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAutonomyRules(organizationId: string): Promise<AutonomyRule[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("autonomy_rules")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .order("kind", { ascending: true });
  if (error) throw new Error(`Errore lista regole: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToRule);
}

export async function getAutonomyRuleByKind(
  organizationId: string,
  kind: string,
): Promise<AutonomyRule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("autonomy_rules")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw new Error(`Errore lookup regola: ${error.message}`);
  return data ? rowToRule(data) : null;
}

export async function updateAutonomyLevel(
  organizationId: string,
  kind: string,
  level: AutonomyLevel,
  updatedBy: string | null,
): Promise<AutonomyRule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("autonomy_rules")
    .update({ level, updated_by: updatedBy })
    .eq("organization_id", organizationId)
    .eq("kind", kind)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore update livello: ${error.message}`);
  return data ? rowToRule(data) : null;
}

export type DiscountForbiddenProduct = {
  id: string;
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  sku: string;
  name: string;
  category: string;
  discountForbidden: boolean;
  discountForbiddenReason: string | null;
};

export async function listAllProductsWithDiscountFlag(
  organizationId: string,
): Promise<DiscountForbiddenProduct[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_products")
    .select(
      "id, organization_id, brand_id, sku, name, category, discount_forbidden, discount_forbidden_reason, brands!inner(slug, display_name, color, is_archived)",
    )
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false)
    .is("archived_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Errore prodotti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): DiscountForbiddenProduct => ({
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
    sku: row.sku,
    name: row.name,
    category: row.category,
    discountForbidden: row.discount_forbidden,
    discountForbiddenReason: row.discount_forbidden_reason ?? null,
  }));
}

export async function setProductDiscountForbidden(
  productId: string,
  organizationId: string,
  forbidden: boolean,
  reason: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    discount_forbidden: forbidden,
    discount_forbidden_reason: forbidden ? reason : null,
  };
  const { error } = await admin
    .from("brand_products")
    .update(patch)
    .eq("id", productId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`Errore toggle discount_forbidden: ${error.message}`);
}
