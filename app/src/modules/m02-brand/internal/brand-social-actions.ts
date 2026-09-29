"use server";

// M02 Brand — Server actions per gestione social account per-brand.
// Owner-only (brand.crud): le credenziali sono roba delicata.
// Validazione: verifica che tutti i campi 'required' siano presenti per la platform.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById } from "./brand-crud-repo";
import { getSchema, type SocialPlatform } from "./brand-social-types";
import { upsertBrandSocialAccount, deleteBrandSocialAccount } from "./brand-social-repo";

async function requireBrandOwnership(brandId: string) {
  const session = await getSessionOrRedirect();
  requireCapability(session, "brand.crud");
  const brand = await getBrandById(session.organizationId, brandId);
  if (!brand) throw new Error("Marchio non trovato");
  return { session, brand };
}

function validateCredentials(platform: SocialPlatform, credentials: Record<string, string>): void {
  const schema = getSchema(platform);
  if (!schema) throw new Error(`Piattaforma "${platform}" non supportata`);
  for (const field of schema.fields) {
    if (field.required) {
      const value = credentials[field.key];
      if (!value || value.trim() === "") {
        throw new Error(`Campo obbligatorio mancante: ${field.label}`);
      }
    }
  }
}

export async function saveBrandSocialAccount(
  brandId: string,
  platform: SocialPlatform,
  credentials: Record<string, string>,
): Promise<void> {
  const { session, brand } = await requireBrandOwnership(brandId);
  validateCredentials(platform, credentials);

  // Rimuovo eventuali campi non presenti nello schema (protezione contro payload manipolati)
  const schema = getSchema(platform);
  const allowedKeys = new Set(schema?.fields.map((f) => f.key) ?? []);
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(credentials)) {
    if (allowedKeys.has(k) && typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) clean[k] = trimmed;
    }
  }

  await upsertBrandSocialAccount({
    organizationId: session.organizationId,
    brandId,
    platform,
    credentials: clean,
    updatedBy: session.userId,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.social_configured",
    target: `brand:${brand.slug}`,
    details: { platform, fieldsSet: Object.keys(clean) },
  });

  revalidatePath("/impostazioni");
  revalidatePath(`/marchi/${brand.slug}`);
}

export async function disconnectBrandSocialAccount(
  brandId: string,
  platform: SocialPlatform,
): Promise<void> {
  const { session, brand } = await requireBrandOwnership(brandId);

  const removed = await deleteBrandSocialAccount(session.organizationId, brandId, platform);
  if (!removed) return; // era gia disconnesso

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.social_disconnected",
    target: `brand:${brand.slug}`,
    details: { platform },
  });

  revalidatePath("/impostazioni");
  revalidatePath(`/marchi/${brand.slug}`);
}
