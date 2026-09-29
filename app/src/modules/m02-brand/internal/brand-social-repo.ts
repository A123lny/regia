// M02 Brand — Repository social account per-brand-per-platform.
// Tenant-scoped su organization_id (RN-87). Upsert su (brand_id, platform) unique.

import { getAdminClient } from "@/lib/db/admin";
import type { BrandSocialAccount, SocialPlatform } from "./brand-social-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAccount(row: any): BrandSocialAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    platform: row.platform as SocialPlatform,
    credentials: (row.credentials ?? {}) as Record<string, string>,
    isConnected: row.is_connected,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null,
  };
}

const SELECT_COLS =
  "id, organization_id, brand_id, platform, credentials, is_connected, updated_at, updated_by";

/**
 * Tenant-scoped: lista tutti gli account social configurati per un brand.
 * Restituisce solo le righe presenti; le piattaforme non configurate non hanno riga.
 */
export async function listBrandSocialAccounts(
  organizationId: string,
  brandId: string,
): Promise<BrandSocialAccount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_social_accounts")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .order("platform");
  if (error) throw new Error(`Errore lettura social account: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToAccount);
}

/**
 * Tenant-scoped upsert: se esiste (brand_id, platform) aggiorna credentials,
 * altrimenti inserisce. Setta is_connected=true e updated_by.
 */
export async function upsertBrandSocialAccount(input: {
  organizationId: string;
  brandId: string;
  platform: SocialPlatform;
  credentials: Record<string, string>;
  updatedBy: string;
}): Promise<BrandSocialAccount> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_social_accounts")
    .upsert(
      {
        organization_id: input.organizationId,
        brand_id: input.brandId,
        platform: input.platform,
        credentials: input.credentials,
        is_connected: true,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      },
      { onConflict: "brand_id,platform" },
    )
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore salvataggio social account: ${error.message}`);
  return rowToAccount(data);
}

/**
 * Tenant-scoped: rimuove la configurazione di una platform (disconnessione).
 * Ritorna true se la riga esisteva.
 */
export async function deleteBrandSocialAccount(
  organizationId: string,
  brandId: string,
  platform: SocialPlatform,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("brand_social_accounts")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("platform", platform);
  if (error) throw new Error(`Errore disconnessione: ${error.message}`);
  return (count ?? 0) > 0;
}
