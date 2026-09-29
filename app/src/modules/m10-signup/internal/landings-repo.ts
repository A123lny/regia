// M10 — repo landing pubbliche di iscrizione.

import { getAdminClient } from "@/lib/db/admin";
import type { SignupLanding } from "./signup-types";

const SELECT_COLS =
  "id, organization_id, brand_id, slug, headline, subheadline, benefit_headline, " +
  "audience_prompt, audience_residente_label, audience_turista_label, " +
  "welcome_offer_id, is_active, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLanding(row: any): SignupLanding {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    slug: row.slug,
    headline: row.headline,
    subheadline: row.subheadline ?? null,
    benefitHeadline: row.benefit_headline,
    audiencePrompt: row.audience_prompt ?? null,
    audienceResidenteLabel: row.audience_residente_label ?? "Residente / pendolare",
    audienceTuristaLabel: row.audience_turista_label ?? "Di passaggio",
    welcomeOfferId: row.welcome_offer_id ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type LandingRow = SignupLanding & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

export async function listLandings(
  organizationId: string,
  includeInactive: boolean = false,
): Promise<LandingRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("signup_landings")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`Errore lista landing: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): LandingRow => ({
    ...rowToLanding(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
}

export async function getLandingById(
  landingId: string,
  organizationId: string,
): Promise<SignupLanding | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("signup_landings")
    .select(SELECT_COLS)
    .eq("id", landingId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura landing: ${error.message}`);
  return data ? rowToLanding(data) : null;
}

/**
 * Lookup pubblico per slug (nessun org filter). Ritorna la landing solo se attiva
 * e brand non archiviato. Usato dalla rotta /iscriviti/[slug].
 */
export async function getPublicLandingBySlug(
  slug: string,
): Promise<
  (SignupLanding & { brandSlug: string; brandDisplayName: string; brandColor: string }) | null
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("signup_landings")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`)
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("brands.is_archived", false)
    .maybeSingle();
  if (error) throw new Error(`Errore lookup landing: ${error.message}`);
  if (!data) return null;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...rowToLanding(data as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    brandSlug: (data as any).brands.slug as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    brandDisplayName: (data as any).brands.display_name as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    brandColor: (data as any).brands.color as string,
  };
}

export type UpsertLandingInput = {
  organizationId: string;
  landingId?: string;
  brandId: string;
  slug: string;
  headline: string;
  subheadline?: string | null;
  benefitHeadline: string;
  audiencePrompt?: string | null;
  audienceResidenteLabel?: string;
  audienceTuristaLabel?: string;
  welcomeOfferId?: string | null;
  isActive: boolean;
};

export async function upsertLanding(input: UpsertLandingInput): Promise<SignupLanding> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    slug: input.slug.trim().toLowerCase(),
    headline: input.headline.trim(),
    subheadline: input.subheadline ?? null,
    benefit_headline: input.benefitHeadline.trim(),
    audience_prompt: input.audiencePrompt ?? null,
    audience_residente_label: input.audienceResidenteLabel ?? "Residente / pendolare",
    audience_turista_label: input.audienceTuristaLabel ?? "Di passaggio",
    welcome_offer_id: input.welcomeOfferId ?? null,
    is_active: input.isActive,
  };
  if (input.landingId) {
    const { data, error } = await admin
      .from("signup_landings")
      .update(row)
      .eq("id", input.landingId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore update landing: ${error.message}`);
    return rowToLanding(data);
  } else {
    const { data, error } = await admin
      .from("signup_landings")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore insert landing: ${error.message}`);
    return rowToLanding(data);
  }
}
