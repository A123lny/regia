// M15 — mappatura template Creatomate configurati per brand.
// Separa gli "scelti e approvati" dall'elenco completo del progetto Creatomate.

import { getAdminClient } from "@/lib/db/admin";

export type BrandCreatomateTemplate = {
  id: string;
  organizationId: string;
  brandId: string;
  templateId: string;
  label: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const SELECT_COLS =
  "id, organization_id, brand_id, template_id, label, description, " +
  "is_active, sort_order, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTemplate(r: any): BrandCreatomateTemplate {
  return {
    id: r.id,
    organizationId: r.organization_id,
    brandId: r.brand_id,
    templateId: r.template_id,
    label: r.label,
    description: r.description ?? null,
    isActive: r.is_active,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listBrandTemplates(
  organizationId: string,
  brandId: string,
  onlyActive: boolean = true,
): Promise<BrandCreatomateTemplate[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("brand_creatomate_templates")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId);
  if (onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error) throw new Error(`listBrandTemplates: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToTemplate);
}

export async function upsertBrandTemplate(input: {
  organizationId: string;
  brandId: string;
  templateId: string;
  label: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<BrandCreatomateTemplate> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_creatomate_templates")
    .upsert(
      {
        organization_id: input.organizationId,
        brand_id: input.brandId,
        template_id: input.templateId,
        label: input.label.trim().slice(0, 80),
        description: input.description ?? null,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 100,
      },
      { onConflict: "brand_id,template_id" },
    )
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`upsertBrandTemplate: ${error.message}`);
  return rowToTemplate(data);
}

export async function removeBrandTemplate(
  organizationId: string,
  templateRowId: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("brand_creatomate_templates")
    .delete({ count: "exact" })
    .eq("id", templateRowId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`removeBrandTemplate: ${error.message}`);
  return (count ?? 0) > 0;
}
