// Scarica l'output di Creatomate (video/img) e lo salva in content-media
// come brand_media_asset. Chiamato quando status=succeeded (dal webhook o
// dal polling).

import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/db/admin";
import { insertMediaAsset, type MediaAsset } from "@/modules/m04-media/public";

const BUCKET = "content-media";

function extFromContentType(ct: string | null): { ext: string; type: string } {
  const c = (ct ?? "").toLowerCase();
  if (c.includes("mp4")) return { ext: "mp4", type: "video/mp4" };
  if (c.includes("webm")) return { ext: "webm", type: "video/webm" };
  if (c.includes("png")) return { ext: "png", type: "image/png" };
  if (c.includes("webp")) return { ext: "webp", type: "image/webp" };
  return { ext: "jpg", type: "image/jpeg" };
}

export async function downloadAndSaveCreatomateOutput(input: {
  outputUrl: string;
  organizationId: string;
  brandId: string;
  caption: string;
  tags: string[];
  uploadedBy: string;
}): Promise<MediaAsset> {
  const res = await fetch(input.outputUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Impossibile scaricare l'output Creatomate (status ${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const { ext, type } = extFromContentType(res.headers.get("content-type"));
  const assetId = randomUUID();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const storagePath = `media/${input.organizationId}/${input.brandId}/${yyyy}/${mm}/${assetId}.${ext}`;

  const admin = getAdminClient();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: type,
    upsert: false,
  });
  if (upErr) {
    console.error("[creatomate] bucket upload failed", {
      bucket: BUCKET,
      path: storagePath,
      msg: upErr.message,
    });
    throw new Error("Impossibile salvare il video/immagine nella Libreria media.");
  }
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  if (signErr || !signed) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error("Output salvato ma URL firmato non disponibile.");
  }

  return insertMediaAsset({
    organizationId: input.organizationId,
    brandId: input.brandId,
    storagePath,
    signedUrl: signed.signedUrl,
    contentType: type as "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm",
    sizeBytes: buf.byteLength,
    width: null,
    height: null,
    tags: input.tags,
    caption: input.caption.slice(0, 500),
    uploadedBy: input.uploadedBy,
  });
}
