"use server";

// Server actions per CRUD della mappatura template per brand (Owner only).

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById } from "@/modules/m02-brand/public";
import { upsertBrandTemplate, removeBrandTemplate } from "./brand-templates-repo";

export type UpsertBrandTemplateResult = { ok: true; id: string } | { ok: false; error: string };

export async function upsertBrandTemplateAction(input: {
  brandId: string;
  templateId: string;
  label: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<UpsertBrandTemplateResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };
  const templateId = input.templateId.trim();
  if (!templateId) return { ok: false, error: "ID template Creatomate obbligatorio." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Etichetta obbligatoria." };

  try {
    const row = await upsertBrandTemplate({
      organizationId: session.organizationId,
      brandId: brand.id,
      templateId,
      label,
      ...(input.description ? { description: input.description } : {}),
      ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
      ...(typeof input.sortOrder === "number" ? { sortOrder: input.sortOrder } : {}),
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "creatomate.brand_template_upserted",
      target: `brand:${brand.slug}`,
      details: { templateId, label },
    });
    revalidatePath(`/marchi/${brand.slug}`);
    return { ok: true, id: row.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore salvataggio template.",
    };
  }
}

export async function removeBrandTemplateAction(
  templateRowId: string,
  brandSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  try {
    const ok = await removeBrandTemplate(session.organizationId, templateRowId);
    if (!ok) return { ok: false, error: "Template non trovato." };
    revalidatePath(`/marchi/${brandSlug}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore eliminazione.",
    };
  }
}
