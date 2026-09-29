"use server";

// M11 — Server action per white label (RF-2.7). Owner-only (team.manage).

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { updatePlatformBrandingRow, type PlatformBranding } from "./platform-branding";

const NAME_MAX = 40;
const NAME_MIN = 1;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const LOGO_BUCKET = "content-media";
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function updatePlatformBranding(patch: {
  platformName?: string;
  platformPrimaryColor?: string | null;
}): Promise<PlatformBranding> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");

  const cleaned: {
    platformName?: string;
    platformPrimaryColor?: string | null;
  } = {};

  if (patch.platformName !== undefined) {
    const name = patch.platformName.trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      throw new Error(`Nome piattaforma: ${NAME_MIN}-${NAME_MAX} caratteri`);
    }
    cleaned.platformName = name;
  }
  if (patch.platformPrimaryColor !== undefined) {
    const c = patch.platformPrimaryColor?.trim() || null;
    if (c !== null && !COLOR_RE.test(c)) {
      throw new Error("Colore primary non valido (#RRGGBB)");
    }
    cleaned.platformPrimaryColor = c;
  }

  const updated = await updatePlatformBrandingRow(session.organizationId, cleaned);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "platform.branding_updated",
    target: `org:${session.organizationId}`,
    details: cleaned,
  });

  revalidatePath("/", "layout");
  return updated;
}

export async function uploadPlatformLogo(formData: FormData): Promise<PlatformBranding> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");

  const file = formData.get("logo");
  if (!(file instanceof File)) throw new Error("File logo mancante");
  if (file.size === 0) throw new Error("File vuoto");
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error(`File troppo grande (max ${Math.floor(LOGO_MAX_BYTES / 1024 / 1024)}MB)`);
  }
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato non supportato. Usa PNG, JPEG, WebP o SVG.");
  }

  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  // Path unico per invalidare cache CDN quando cambia
  const objectPath = `platform-logos/${session.organizationId}/${randomUUID()}.${ext}`;

  const admin = getAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Errore upload: ${uploadError.message}`);

  const { data: signed, error: signError } = await admin.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(objectPath, 60 * 60 * 24 * 365 * 10);
  if (signError || !signed) {
    await admin.storage.from(LOGO_BUCKET).remove([objectPath]);
    throw new Error(`Errore URL: ${signError?.message ?? ""}`);
  }

  const updated = await updatePlatformBrandingRow(session.organizationId, {
    platformLogoUrl: signed.signedUrl,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "platform.logo_uploaded",
    target: `org:${session.organizationId}`,
    details: { contentType: file.type, sizeBytes: file.size },
  });

  revalidatePath("/", "layout");
  return updated;
}

export async function removePlatformLogo(): Promise<PlatformBranding> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");

  const updated = await updatePlatformBrandingRow(session.organizationId, {
    platformLogoUrl: null,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "platform.logo_removed",
    target: `org:${session.organizationId}`,
    details: {},
  });

  revalidatePath("/", "layout");
  return updated;
}
