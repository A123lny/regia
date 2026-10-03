// RF-4.3 Provider di generazione media esterna: ToS/diritti verificati.
// Non e' un controllo per generazione: e' condizione di ammissione del fornitore.

import { getAdminClient } from "@/lib/db/admin";

export type ProviderKind = "image" | "video" | "both";
export type RightsHolder = "user" | "provider" | "shared" | "public_domain";
export type AllowedUse = "commercial" | "editorial" | "personal";

export const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  image: "Immagini",
  video: "Video",
  both: "Immagini + Video",
};

export const RIGHTS_HOLDER_LABELS: Record<RightsHolder, string> = {
  user: "Noi (chi paga il servizio)",
  provider: "Il provider",
  shared: "Condivisi (co-ownership)",
  public_domain: "Dominio pubblico / libero",
};

export const RIGHTS_HOLDER_HINTS: Record<RightsHolder, string> = {
  user: "Possiamo usare, modificare e distribuire gli output senza altre autorizzazioni.",
  provider: "L'output resta del provider: dobbiamo chiedere permesso ad ogni uso commerciale.",
  shared:
    "Diritti condivisi: possiamo usare l'output ma il provider puo' anche a sua volta usarlo (training, portfolio).",
  public_domain: "Nessun diritto riservato, uso libero.",
};

export const ALLOWED_USE_LABELS: Record<AllowedUse, string> = {
  commercial: "Commerciale (marketing, vendita)",
  editorial: "Editoriale (informazione, giornalismo)",
  personal: "Personale (non commerciale)",
};

export type MediaProvider = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  providerKind: ProviderKind;
  tosUrl: string | null;
  rightsHolder: RightsHolder;
  allowedUses: AllowedUse[];
  restrictedSectors: string[];
  verifiedAt: string;
  verificationNotes: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProvider(row: any): MediaProvider {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    providerKind: row.provider_kind as ProviderKind,
    tosUrl: row.tos_url ?? null,
    rightsHolder: row.rights_holder as RightsHolder,
    allowedUses: (row.allowed_uses ?? []) as AllowedUse[],
    restrictedSectors: (row.restricted_sectors ?? []) as string[],
    verifiedAt: row.verified_at,
    verificationNotes: row.verification_notes ?? null,
    isActive: row.is_active,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMediaProviders(
  organizationId: string,
  includeArchived: boolean = false,
): Promise<MediaProvider[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin.from("media_providers").select("*").eq("organization_id", organizationId);
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) throw new Error(`listMediaProviders: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToProvider);
}

export type UpsertMediaProviderInput = {
  organizationId: string;
  providerId?: string;
  name: string;
  slug: string;
  providerKind: ProviderKind;
  tosUrl?: string | null;
  rightsHolder: RightsHolder;
  allowedUses: AllowedUse[];
  restrictedSectors?: string[];
  verificationNotes?: string | null;
  verifiedBy: string | null;
  isActive?: boolean;
};

export async function upsertMediaProvider(input: UpsertMediaProviderInput): Promise<MediaProvider> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    name: input.name.trim(),
    slug,
    provider_kind: input.providerKind,
    tos_url: input.tosUrl ?? null,
    rights_holder: input.rightsHolder,
    allowed_uses: input.allowedUses,
    restricted_sectors: input.restrictedSectors ?? [],
    verification_notes: input.verificationNotes ?? null,
    verified_by: input.verifiedBy,
    verified_at: new Date().toISOString(),
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };
  if (input.providerId) {
    const { data, error } = await admin
      .from("media_providers")
      .update(row)
      .eq("id", input.providerId)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    if (error) throw new Error(`upsertMediaProvider update: ${error.message}`);
    return rowToProvider(data);
  }
  const { data, error } = await admin.from("media_providers").insert(row).select("*").single();
  if (error) throw new Error(`upsertMediaProvider insert: ${error.message}`);
  return rowToProvider(data);
}

export async function archiveMediaProvider(
  organizationId: string,
  providerId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("media_providers")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", providerId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`archiveMediaProvider: ${error.message}`);
}

/**
 * RF-4.3 guard: cerca provider attivo per uso commercial. Chiamato dall'adapter
 * concreto (quando colleghi fal.ai o altro) prima di generare.
 * Se nessun provider attivo con allowed_uses='commercial' e il contenuto e'
 * commerciale, la generazione deve fallire con messaggio chiaro all'Owner.
 *
 * In F1 il M04 usa solo template interni (satori), quindi questa guard non
 * e' ancora chiamata dal codice di generazione. Diventa attiva quando si
 * colleghera' un provider esterno reale.
 */
export async function hasActiveProviderForUse(
  organizationId: string,
  kind: ProviderKind,
  use: AllowedUse,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("media_providers")
    .select("id, allowed_uses, provider_kind")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("archived_at", null);
  if (error) throw new Error(`hasActiveProviderForUse: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).some((p) => {
    const kindMatch = p.provider_kind === kind || p.provider_kind === "both";
    const uses = (p.allowed_uses ?? []) as string[];
    return kindMatch && uses.includes(use);
  });
}
