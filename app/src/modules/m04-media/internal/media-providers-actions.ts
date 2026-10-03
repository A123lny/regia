"use server";

// M04 — Server actions provider media esterna (RF-4.3).
// Registrazione fornitori (fal.ai, Replicate, DALL-E, ecc.) con ToS verificati,
// diritti/usi/settori proibiti. Owner-only: materia compliance strategica.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  upsertMediaProvider,
  archiveMediaProvider,
  type MediaProvider,
  type ProviderKind,
  type RightsHolder,
  type AllowedUse,
} from "./media-providers-repo";

export type UpsertMediaProviderActionInput = {
  providerId?: string;
  name: string;
  slug: string;
  providerKind: ProviderKind;
  tosUrl?: string | null;
  rightsHolder: RightsHolder;
  allowedUses: AllowedUse[];
  restrictedSectors?: string[];
  verificationNotes?: string | null;
  isActive?: boolean;
};

export type UpsertMediaProviderActionResult =
  { ok: true; provider: MediaProvider } | { ok: false; error: string };

export async function upsertMediaProviderAction(
  input: UpsertMediaProviderActionInput,
): Promise<UpsertMediaProviderActionResult> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "media_providers.manage");

    if (!input.name.trim()) return { ok: false, error: "Nome obbligatorio" };
    if (!input.slug.trim()) return { ok: false, error: "Slug obbligatorio" };

    // Scheme guard sull'URL T&C: evita javascript:/data: come href (XSS).
    if (input.tosUrl) {
      let u: URL;
      try {
        u = new URL(input.tosUrl);
      } catch {
        return { ok: false, error: "URL T&C non valido" };
      }
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { ok: false, error: "URL T&C deve essere http:// o https://" };
      }
    }

    const provider = await upsertMediaProvider({
      organizationId: session.organizationId,
      ...(input.providerId ? { providerId: input.providerId } : {}),
      name: input.name,
      slug: input.slug,
      providerKind: input.providerKind,
      tosUrl: input.tosUrl ?? null,
      rightsHolder: input.rightsHolder,
      allowedUses: input.allowedUses,
      restrictedSectors: input.restrictedSectors ?? [],
      verificationNotes: input.verificationNotes ?? null,
      verifiedBy: session.userId,
      isActive: input.isActive ?? true,
    });

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.providerId ? "media_provider.updated" : "media_provider.registered",
      target: `media_provider:${provider.slug}`,
      details: {
        providerId: provider.id,
        kind: provider.providerKind,
        rightsHolder: provider.rightsHolder,
        allowedUses: provider.allowedUses,
        restrictedSectors: provider.restrictedSectors,
      },
    });

    revalidatePath("/impostazioni/provider-media");
    return { ok: true, provider };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ArchiveMediaProviderActionResult = { ok: true } | { ok: false; error: string };

export async function archiveMediaProviderAction(
  providerId: string,
): Promise<ArchiveMediaProviderActionResult> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "media_providers.manage");

    await archiveMediaProvider(session.organizationId, providerId);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "media_provider.archived",
      target: `media_provider:${providerId}`,
      details: {},
    });

    revalidatePath("/impostazioni/provider-media");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
