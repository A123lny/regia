"use server";

// M10 — admin actions per landing CRUD (authenticated).

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { upsertLanding, getLandingById } from "./landings-repo";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

async function requireOwnedBrand(brandId: string, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, organization_id, is_archived")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Marchio non trovato");
  if (data.organization_id !== organizationId) throw new Error("Accesso negato al marchio");
  if (data.is_archived) throw new Error("Marchio archiviato");
  return data as { id: string; slug: string };
}

export type UpsertLandingActionInput = {
  landingId?: string;
  brandId: string;
  slug: string;
  headline: string;
  subheadline?: string;
  benefitHeadline: string;
  audiencePrompt?: string;
  audienceResidenteLabel?: string;
  audienceTuristaLabel?: string;
  welcomeOfferId?: string;
  isActive: boolean;
};

export async function upsertLandingAction(
  input: UpsertLandingActionInput,
): Promise<{ ok: true; landingId: string; slug: string } | { ok: false; error: string }> {
  const session = await requireAuth("signup.landing.crud");
  await requireOwnedBrand(input.brandId, session.organizationId);

  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(input.slug.trim().toLowerCase())) {
    return {
      ok: false,
      error: "Slug non valido: lettere minuscole, cifre e trattini (2-64 char)",
    };
  }

  try {
    const payload: Parameters<typeof upsertLanding>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      slug: input.slug,
      headline: input.headline,
      benefitHeadline: input.benefitHeadline,
      isActive: input.isActive,
    };
    if (input.landingId) payload.landingId = input.landingId;
    if (input.subheadline !== undefined) payload.subheadline = input.subheadline;
    if (input.audiencePrompt !== undefined) payload.audiencePrompt = input.audiencePrompt;
    if (input.audienceResidenteLabel !== undefined)
      payload.audienceResidenteLabel = input.audienceResidenteLabel;
    if (input.audienceTuristaLabel !== undefined)
      payload.audienceTuristaLabel = input.audienceTuristaLabel;
    if (input.welcomeOfferId !== undefined) payload.welcomeOfferId = input.welcomeOfferId;

    const landing = await upsertLanding(payload);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.landingId ? "signup.landing_updated" : "signup.landing_created",
      target: `brand:${input.brandId}`,
      details: { landingId: landing.id, slug: landing.slug, active: landing.isActive },
    });

    revalidatePath("/iscrizioni");
    revalidatePath(`/iscriviti/${landing.slug}`);
    return { ok: true, landingId: landing.id, slug: landing.slug };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function archiveLandingAction(landingId: string): Promise<void> {
  const session = await requireAuth("signup.landing.crud");
  const landing = await getLandingById(landingId, session.organizationId);
  if (!landing) throw new Error("Landing non trovata");
  // Soft-archive = set is_active=false (non tocchiamo record perché ci sono FK da signup_events)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("signup_landings")
    .update({ is_active: false })
    .eq("id", landingId)
    .eq("organization_id", session.organizationId);
  if (error) throw new Error(`Errore disattivazione: ${error.message}`);
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "signup.landing_disabled",
    target: `landing:${landingId}`,
    details: { slug: landing.slug },
  });
  revalidatePath("/iscrizioni");
}
