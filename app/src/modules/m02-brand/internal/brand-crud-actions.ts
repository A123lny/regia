"use server";

// M02 Brand — Server actions per CRUD marchi (RF-2.1).
// Owner-only + tenant-scoped + audit + revalidate. Slug editabile ma senza redirect
// legacy: bookmark su vecchio slug diventano 404 (limite noto).

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  insertBrand,
  updateBrandRow,
  setBrandArchived,
  setBrandLogoUrl,
  getBrandById,
  BRAND_FONTS_ALLOWED,
  type Brand,
  type BrandFontFamily,
} from "./brand-crud-repo";

const LOGO_BUCKET = "content-media";
const LOGO_MAX_BYTES = 1024 * 1024 * 2; // 2 MB
const LOGO_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const SLUG_RE = /^[a-z][a-z0-9-]{1,49}$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const NAME_MAX = 60;

async function requireBrandCrud() {
  const session = await getSessionOrRedirect();
  requireCapability(session, "brand.crud");
  return session;
}

function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      "Slug non valido. Deve iniziare con una lettera e contenere solo a-z, 0-9, trattino (2-50 caratteri).",
    );
  }
}

function validateColor(color: string): void {
  if (!COLOR_RE.test(color)) {
    throw new Error("Colore non valido. Formato richiesto: #RRGGBB (esadecimale).");
  }
}

function validateDisplayName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Il nome del marchio non puo essere vuoto");
  if (trimmed.length > NAME_MAX) {
    throw new Error(`Il nome del marchio non puo superare ${NAME_MAX} caratteri`);
  }
}

function revalidateAll(slug?: string, oldSlug?: string) {
  revalidatePath("/marchi");
  revalidatePath("/dashboard");
  revalidatePath("/contenuti");
  revalidatePath("/contenuti/calendario");
  if (slug) {
    revalidatePath(`/marchi/${slug}`);
    revalidatePath(`/contenuti/${slug}`);
    revalidatePath(`/contenuti/${slug}/calendario`);
  }
  if (oldSlug && oldSlug !== slug) {
    revalidatePath(`/marchi/${oldSlug}`);
    revalidatePath(`/contenuti/${oldSlug}`);
    revalidatePath(`/contenuti/${oldSlug}/calendario`);
  }
}

export async function createBrand(input: {
  displayName: string;
  slug: string;
  color: string;
}): Promise<Brand> {
  const session = await requireBrandCrud();
  const displayName = input.displayName.trim();
  const slug = input.slug.trim().toLowerCase();
  const color = input.color.trim();
  validateDisplayName(displayName);
  validateSlug(slug);
  validateColor(color);

  const created = await insertBrand({
    organizationId: session.organizationId,
    slug,
    displayName,
    color,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.created",
    target: `brand:${slug}`,
    details: { brandId: created.id, slug, displayName, color },
  });

  revalidateAll(slug);
  return created;
}

export async function updateBrand(
  brandId: string,
  patch: {
    displayName?: string;
    slug?: string;
    color?: string;
    fontFamily?: string;
    emailFromAddress?: string | null;
    emailFromDisplayName?: string | null;
    emailReplyTo?: string | null;
    googlePlaceId?: string | null;
    openingHours?: import("./opening-hours").OpeningHours | null;
  },
): Promise<Brand> {
  const session = await requireBrandCrud();

  // Fetch stato attuale per validare + audit + rev del vecchio slug
  const current = await getBrandById(session.organizationId, brandId);
  if (!current) throw new Error("Marchio non trovato");

  const dbPatch: {
    displayName?: string;
    slug?: string;
    color?: string;
    fontFamily?: BrandFontFamily;
    emailFromAddress?: string | null;
    emailFromDisplayName?: string | null;
    emailReplyTo?: string | null;
    googlePlaceId?: string | null;
    openingHours?: import("./opening-hours").OpeningHours | null;
  } = {};
  if (patch.displayName !== undefined) {
    const dn = patch.displayName.trim();
    validateDisplayName(dn);
    if (dn !== current.displayName) dbPatch.displayName = dn;
  }
  if (patch.slug !== undefined) {
    const s = patch.slug.trim().toLowerCase();
    validateSlug(s);
    if (s !== current.slug) dbPatch.slug = s;
  }
  if (patch.color !== undefined) {
    const c = patch.color.trim();
    validateColor(c);
    if (c !== current.color) dbPatch.color = c;
  }
  if (patch.fontFamily !== undefined) {
    const f = patch.fontFamily.trim();
    if (!(BRAND_FONTS_ALLOWED as readonly string[]).includes(f)) {
      throw new Error(`Font "${f}" non consentito. Scegli tra: ${BRAND_FONTS_ALLOWED.join(", ")}`);
    }
    if (f !== current.fontFamily) dbPatch.fontFamily = f as BrandFontFamily;
  }
  // RF-2.2a: identita email. Passing "" o null azzera il campo.
  if (patch.emailFromAddress !== undefined) {
    const v = patch.emailFromAddress?.trim() || null;
    if (v !== null && !EMAIL_RE.test(v)) {
      throw new Error("Indirizzo email mittente non valido (formato).");
    }
    if (v !== current.emailFromAddress) dbPatch.emailFromAddress = v;
  }
  if (patch.emailFromDisplayName !== undefined) {
    const v = patch.emailFromDisplayName?.trim().slice(0, 100) || null;
    if (v !== current.emailFromDisplayName) dbPatch.emailFromDisplayName = v;
  }
  if (patch.emailReplyTo !== undefined) {
    const v = patch.emailReplyTo?.trim() || null;
    if (v !== null && !EMAIL_RE.test(v)) {
      throw new Error("Indirizzo email reply-to non valido (formato).");
    }
    if (v !== current.emailReplyTo) dbPatch.emailReplyTo = v;
  }
  if (patch.googlePlaceId !== undefined) {
    const v = patch.googlePlaceId?.trim() || null;
    // Google Place IDs iniziano con "ChIJ" e sono alfanumerici+_- di solito 27+ chars
    if (v !== null && (v.length < 10 || v.length > 255)) {
      throw new Error("Google Place ID non valido (lunghezza 10-255 caratteri).");
    }
    if (v !== current.googlePlaceId) dbPatch.googlePlaceId = v;
  }
  // RN-76 Orari apertura: validazione shape runtime oltre al constraint DB.
  if (patch.openingHours !== undefined) {
    const v = patch.openingHours;
    if (v !== null) {
      const { isValidOpeningHours } = await import("./opening-hours");
      if (!isValidOpeningHours(v)) {
        throw new Error("Orari apertura: formato non valido (atteso HH:mm con close > open).");
      }
    }
    // Confronto JSON per evitare update rumoroso: Supabase accetta jsonb così com'è
    const prev = current.openingHours;
    const changed = JSON.stringify(prev) !== JSON.stringify(v);
    if (changed) dbPatch.openingHours = v;
  }

  if (Object.keys(dbPatch).length === 0) return current;

  const updated = await updateBrandRow(session.organizationId, brandId, dbPatch);
  if (!updated) throw new Error("Marchio non trovato o modificato da un'altra sessione");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.updated",
    target: `brand:${updated.slug}`,
    details: {
      brandId,
      before: {
        slug: current.slug,
        displayName: current.displayName,
        color: current.color,
      },
      after: dbPatch,
    },
  });

  revalidateAll(updated.slug, current.slug);
  return updated;
}

export async function archiveBrand(brandId: string): Promise<Brand> {
  const session = await requireBrandCrud();
  const current = await getBrandById(session.organizationId, brandId);
  if (!current) throw new Error("Marchio non trovato");
  if (current.isArchived) return current;

  const updated = await setBrandArchived(session.organizationId, brandId, true);
  if (!updated) throw new Error("Marchio non archiviabile");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.archived",
    target: `brand:${current.slug}`,
    details: { brandId },
  });

  revalidateAll(current.slug);
  return updated;
}

/**
 * Upload logo per un marchio (RF-2.2). Accetta PNG/JPEG/WebP/SVG max 2MB.
 * Sostituisce l'eventuale logo esistente (upsert su path stabile per brand).
 * Salva URL pubblico in brands.logo_url.
 */
export async function uploadBrandLogo(brandId: string, formData: FormData): Promise<Brand> {
  const session = await requireBrandCrud();
  const current = await getBrandById(session.organizationId, brandId);
  if (!current) throw new Error("Marchio non trovato");

  const file = formData.get("logo");
  if (!(file instanceof File)) throw new Error("File logo mancante");
  if (file.size === 0) throw new Error("File vuoto");
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error(`File troppo grande (max ${Math.floor(LOGO_MAX_BYTES / 1024 / 1024)}MB)`);
  }
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato non supportato. Usa PNG, JPEG, WebP o SVG.");
  }

  // Path stabile per brand: sovrascrive vecchio logo se esistente.
  // Estensione derivata dal MIME type per evitare estensioni fake.
  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const objectPath = `brand-logos/${session.organizationId}/${brandId}.${ext}`;

  const admin = getAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await admin.storage.from(LOGO_BUCKET).upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) throw new Error(`Errore upload storage: ${uploadError.message}`);

  // URL pubblico (bucket privato → signed url a lunga scadenza).
  const { data: signed, error: signError } = await admin.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(objectPath, 60 * 60 * 24 * 365 * 10); // 10 anni
  if (signError || !signed) throw new Error(`Errore creazione URL: ${signError?.message ?? ""}`);

  const updated = await setBrandLogoUrl(session.organizationId, brandId, signed.signedUrl);
  if (!updated) throw new Error("Marchio non trovato dopo update");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.logo_uploaded",
    target: `brand:${updated.slug}`,
    details: { brandId, contentType: file.type, sizeBytes: file.size },
  });

  revalidateAll(updated.slug);
  return updated;
}

/**
 * Rimuove il logo di un marchio (azzera logo_url + delete file storage).
 * Non fallisce se il file non esisteva.
 */
export async function removeBrandLogo(brandId: string): Promise<Brand> {
  const session = await requireBrandCrud();
  const current = await getBrandById(session.organizationId, brandId);
  if (!current) throw new Error("Marchio non trovato");
  if (!current.logoUrl) return current;

  const admin = getAdminClient();
  // Best-effort: elimina tutti i file possibili per il brand (variazioni di estensione)
  for (const ext of ["png", "jpg", "webp", "svg"]) {
    await admin.storage
      .from(LOGO_BUCKET)
      .remove([`brand-logos/${session.organizationId}/${brandId}.${ext}`]);
  }

  const updated = await setBrandLogoUrl(session.organizationId, brandId, null);
  if (!updated) throw new Error("Marchio non trovato dopo rimozione");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.logo_removed",
    target: `brand:${updated.slug}`,
    details: { brandId },
  });

  revalidateAll(updated.slug);
  return updated;
}

export async function restoreBrand(brandId: string): Promise<Brand> {
  const session = await requireBrandCrud();
  const current = await getBrandById(session.organizationId, brandId);
  if (!current) throw new Error("Marchio non trovato");
  if (!current.isArchived) return current;

  const updated = await setBrandArchived(session.organizationId, brandId, false);
  if (!updated) throw new Error("Marchio non ripristinabile");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand.restored",
    target: `brand:${current.slug}`,
    details: { brandId },
  });

  revalidateAll(current.slug);
  return updated;
}
