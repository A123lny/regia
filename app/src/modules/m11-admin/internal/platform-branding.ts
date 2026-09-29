// M11 — RF-2.7 Platform branding (white label).
// Legge/scrive campi platform_* di organizations.

import { getAdminClient } from "@/lib/db/admin";

export type PlatformBranding = {
  organizationId: string;
  platformName: string;
  platformLogoUrl: string | null;
  platformPrimaryColor: string | null;
};

export async function getPlatformBranding(organizationId: string): Promise<PlatformBranding> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("organizations")
    .select("id, platform_name, platform_logo_url, platform_primary_color")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura branding: ${error.message}`);
  if (!data) throw new Error("Organization non trovata");
  return {
    organizationId: data.id,
    platformName: data.platform_name ?? "Regìa",
    platformLogoUrl: data.platform_logo_url ?? null,
    platformPrimaryColor: data.platform_primary_color ?? null,
  };
}

export async function updatePlatformBrandingRow(
  organizationId: string,
  patch: {
    platformName?: string;
    platformLogoUrl?: string | null;
    platformPrimaryColor?: string | null;
  },
): Promise<PlatformBranding> {
  const dbPatch: Record<string, string | null> = {};
  if (patch.platformName !== undefined) dbPatch["platform_name"] = patch.platformName;
  if (patch.platformLogoUrl !== undefined) dbPatch["platform_logo_url"] = patch.platformLogoUrl;
  if (patch.platformPrimaryColor !== undefined)
    dbPatch["platform_primary_color"] = patch.platformPrimaryColor;
  if (Object.keys(dbPatch).length === 0) return getPlatformBranding(organizationId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("organizations").update(dbPatch).eq("id", organizationId);
  if (error) throw new Error(`Errore aggiornamento branding: ${error.message}`);
  return getPlatformBranding(organizationId);
}
