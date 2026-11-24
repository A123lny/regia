"use server";

// M04 — Server actions media asset (RF-4.1 + RF-4.2 template).
// Owner + Editor: entrambi possono uploadare/editare/eliminare (brand.kit.edit capability).
// Storage: bucket 'content-media' con path 'media/{org}/{brand}/{yyyy}/{mm}/{uuid}.{ext}'.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById, getBrandBySlug } from "@/modules/m02-brand/public";
import {
  insertMediaAsset,
  updateMediaAssetMeta,
  deleteMediaAssetRow,
  setDraftMediaAsset,
} from "./media-assets-repo";
import type { MediaAsset, MediaAssetContentType } from "./media-assets-types";
import { renderTemplateToPng } from "./templates/renderer";
import { getTemplateDefinition } from "./templates/template-registry";

const MEDIA_BUCKET = "content-media";
const MEDIA_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set<MediaAssetContentType>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function extFromType(t: MediaAssetContentType): string {
  if (t === "image/svg+xml") return "svg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  return "jpg";
}

function pathForAsset(orgId: string, brandId: string, assetId: string, ext: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `media/${orgId}/${brandId}/${yyyy}/${mm}/${assetId}.${ext}`;
}

async function requireBrandForMedia(brandId: string) {
  const session = await getSessionOrRedirect();
  requireCapability(session, "brand.kit.edit");
  const brand = await getBrandById(session.organizationId, brandId);
  if (!brand) throw new Error("Marchio non trovato");
  return { session, brand };
}

export async function uploadMediaAsset(brandId: string, formData: FormData): Promise<MediaAsset> {
  const { session, brand } = await requireBrandForMedia(brandId);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File mancante");
  if (file.size === 0) throw new Error("File vuoto");
  if (file.size > MEDIA_MAX_BYTES) {
    throw new Error(`File troppo grande (max ${Math.floor(MEDIA_MAX_BYTES / 1024 / 1024)}MB)`);
  }
  if (!ALLOWED_TYPES.has(file.type as MediaAssetContentType)) {
    throw new Error("Formato non supportato. Usa PNG, JPEG, WebP o SVG.");
  }

  const caption = String(formData.get("caption") ?? "")
    .trim()
    .slice(0, 500);
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40)
        .slice(0, 20)
    : [];

  const contentType = file.type as MediaAssetContentType;
  const assetId = randomUUID();
  const ext = extFromType(contentType);
  const storagePath = pathForAsset(session.organizationId, brand.id, assetId, ext);

  const admin = getAdminClient();
  let bytes: Uint8Array;
  try {
    const arrayBuffer = await file.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer);
  } catch (err) {
    console.error("[media] file.arrayBuffer fallito", {
      name: file.name,
      size: file.size,
      err: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Impossibile leggere il file. Riprova con un file piu' piccolo.");
  }

  const { error: uploadError } = await admin.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: false,
  });
  if (uploadError) {
    // Log server-side il dettaglio (utile se e' bucket mancante o RLS).
    console.error("[media] storage.upload fallito", {
      bucket: MEDIA_BUCKET,
      path: storagePath,
      msg: uploadError.message,
    });
    // Messaggio generico al client, nessun leak di bucket name / path.
    throw new Error(
      "Impossibile salvare l'immagine. Verifica che il bucket di storage sia configurato.",
    );
  }

  // Signed URL ~1 anno (prima era 10 anni, URL piu' pesante nel body del
  // server action -> contribuiva al React #441 su upload grandi). 1 anno
  // basta per il ciclo editoriale, rinnovabile via regenerate signed URL.
  const { data: signed, error: signError } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  if (signError || !signed) {
    // Cleanup se fallisce
    await admin.storage.from(MEDIA_BUCKET).remove([storagePath]);
    console.error("[media] createSignedUrl fallito", {
      path: storagePath,
      msg: signError?.message,
    });
    throw new Error("Immagine caricata ma URL di accesso non disponibile. Contatta il supporto.");
  }

  // Dimensioni: solo per raster (per SVG lasciamo null)
  // In server components node non abbiamo image-size senza dep. Lasciamo null in F1;
  // il client puo popolarle in un secondo momento con onLoad se serve.
  const width: number | null = null;
  const height: number | null = null;

  const asset = await insertMediaAsset({
    organizationId: session.organizationId,
    brandId: brand.id,
    storagePath,
    signedUrl: signed.signedUrl,
    contentType,
    sizeBytes: file.size,
    width,
    height,
    tags,
    caption,
    uploadedBy: session.userId,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.uploaded",
    target: `brand:${brand.slug}`,
    details: {
      assetId: asset.id,
      contentType,
      sizeBytes: file.size,
      tagCount: tags.length,
    },
  });

  revalidatePath(`/marchi/${brand.slug}/media`);
  revalidatePath(`/marchi/${brand.slug}`);
  return asset;
}

export async function deleteMediaAsset(assetId: string): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "brand.kit.edit");

  const removed = await deleteMediaAssetRow(session.organizationId, assetId);
  if (!removed) throw new Error("Asset non trovato");

  const admin = getAdminClient();
  await admin.storage.from(MEDIA_BUCKET).remove([removed.storagePath]);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.deleted",
    target: `asset:${assetId}`,
    details: { storagePath: removed.storagePath },
  });

  revalidatePath("/marchi");
}

export async function updateMediaAssetCaption(
  assetId: string,
  caption: string,
): Promise<MediaAsset> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "brand.kit.edit");
  const trimmed = caption.trim().slice(0, 500);
  const updated = await updateMediaAssetMeta(session.organizationId, assetId, {
    caption: trimmed,
  });
  if (!updated) throw new Error("Asset non trovato");

  const brand = updated.brandId
    ? await getBrandById(session.organizationId, updated.brandId)
    : null;
  if (brand) revalidatePath(`/marchi/${brand.slug}/media`);
  return updated;
}

export async function updateMediaAssetTags(assetId: string, tagsCsv: string): Promise<MediaAsset> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "brand.kit.edit");
  const tags = tagsCsv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 40)
    .slice(0, 20);
  const updated = await updateMediaAssetMeta(session.organizationId, assetId, { tags });
  if (!updated) throw new Error("Asset non trovato");

  const brand = await getBrandById(session.organizationId, updated.brandId);
  if (brand) revalidatePath(`/marchi/${brand.slug}/media`);
  return updated;
}

/**
 * Aggancia un asset a un draft. brandSlug per revalidatePath.
 */
export async function attachMediaAssetToDraft(
  draftId: string,
  assetId: string,
  brandSlug: string,
): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");
  const brand = await getBrandBySlug(session.organizationId, brandSlug);
  if (!brand) throw new Error("Marchio non trovato");

  const ok = await setDraftMediaAsset(session.organizationId, draftId, assetId);
  if (!ok) throw new Error("Bozza non trovata o non accessibile");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.attached_to_draft",
    target: `draft:${draftId}`,
    details: { assetId },
  });

  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);
}

/**
 * RF-4.2: genera un'immagine da un template, la salva in libreria e l'attach al draft.
 * Sequenziale: render server-side (~500-2000ms), upload, insert asset, attach.
 */
export type GenerateFromTemplateResult =
  | { ok: true; assetId: string }
  | { ok: false; error: string };

export async function generateFromTemplate(input: {
  draftId: string;
  brandSlug: string;
  templateId: string;
  fields: Record<string, string>;
}): Promise<GenerateFromTemplateResult> {
  try {
    const session = await getSessionOrRedirect();
    try {
      requireCapability(session, "content.generate");
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
    }

    const brand = await getBrandBySlug(session.organizationId, input.brandSlug);
    if (!brand) return { ok: false, error: "Marchio non trovato." };

    const def = getTemplateDefinition(input.templateId);
    if (!def) return { ok: false, error: `Template "${input.templateId}" non trovato.` };

    for (const f of def.fields) {
      if (f.required && !(input.fields[f.key] ?? "").trim()) {
        return { ok: false, error: `Campo obbligatorio mancante: ${f.label}` };
      }
    }

    const { pngBytes, width, height } = await renderTemplateToPng(input.templateId, {
      brandDisplayName: brand.displayName,
      brandColor: brand.color,
      brandLogoUrl: brand.logoUrl,
      fields: input.fields,
    });

    const assetId = randomUUID();
    const storagePath = pathForAsset(session.organizationId, brand.id, assetId, "png");
    const admin = getAdminClient();
    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, pngBytes, { contentType: "image/png", upsert: false });
    if (uploadError) {
      console.error("[media] template upload failed", {
        path: storagePath,
        msg: uploadError.message,
      });
      return {
        ok: false,
        error: "Impossibile salvare il template. Verifica la configurazione del bucket.",
      };
    }
    const { data: signed, error: signError } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    if (signError || !signed) {
      await admin.storage.from(MEDIA_BUCKET).remove([storagePath]);
      return { ok: false, error: "Immagine salvata ma URL firmato non disponibile." };
    }

    const caption = `[template:${input.templateId}] ${(
      input.fields["title"] ||
      input.fields["headline"] ||
      input.fields["service"] ||
      input.fields["name"] ||
      def.name
    ).slice(0, 150)}`;

    const asset = await insertMediaAsset({
      organizationId: session.organizationId,
      brandId: brand.id,
      storagePath,
      signedUrl: signed.signedUrl,
      contentType: "image/png",
      sizeBytes: pngBytes.byteLength,
      width,
      height,
      tags: ["template", "auto-generated", input.templateId],
      caption,
      uploadedBy: session.userId,
    });

    await setDraftMediaAsset(session.organizationId, input.draftId, asset.id);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "media.template_generated",
      target: `draft:${input.draftId}`,
      details: {
        assetId: asset.id,
        templateId: input.templateId,
        sizeBytes: pngBytes.byteLength,
      },
    });

    revalidatePath(`/contenuti/${input.brandSlug}/${input.draftId}`);
    revalidatePath(`/marchi/${input.brandSlug}/media`);
    return { ok: true, assetId: asset.id };
  } catch (err) {
    // Rete di sicurezza: nessuna action deve lanciare un errore React
    // grezzo (#441 "Returning an unserializable value from a Server Function").
    console.error("[media] generateFromTemplate failed", {
      draftId: input.draftId,
      templateId: input.templateId,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Errore sconosciuto nella generazione del template.",
    };
  }
}

export async function detachMediaAssetFromDraft(draftId: string, brandSlug: string): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const ok = await setDraftMediaAsset(session.organizationId, draftId, null);
  if (!ok) throw new Error("Bozza non trovata");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.detached_from_draft",
    target: `draft:${draftId}`,
    details: {},
  });

  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);
}
