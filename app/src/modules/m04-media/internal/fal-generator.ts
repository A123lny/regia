// Generatore immagini AI (fal.ai).
// Compone il prompt da bozza + brand kit + canale, genera varianti via fal,
// salva la scelta nel bucket content-media come nuovo brand_media_asset.
//
// NON è un server action: è la logica pura chiamata da fal-actions.ts.
// L'autorizzazione (capability, provider attivo, kill switch, budget) vive
// nelle action.

import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/db/admin";
import { getBrandById, getBrandKitWithLists } from "@/modules/m02-brand/public";
import { generateImages, type GenerateImagesResult } from "@/lib/ai/fal";
import {
  FAL_SIZE_BY_CHANNEL,
  type DraftChannelHint,
  type FalImageModelId,
  type FalImageSize,
} from "@/lib/ai/fal-config";
import { insertMediaAsset } from "./media-assets-repo";
import type { MediaAsset } from "./media-assets-types";

const MEDIA_BUCKET = "content-media";

// ────────────────────────────────────────────────────────────────────────
// Prompt builder
// ────────────────────────────────────────────────────────────────────────

function sanitizeForPrompt(s: string, maxLen: number): string {
  // Rimuovi direttive che potrebbero confondere il modello di immagini.
  // Il testo arriva già da content_drafts.generated_text (output AI): non
  // contiene istruzioni ma puo' avere markdown.
  return s
    .replace(/[*_`#>]/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export type ComposedPrompt = {
  prompt: string;
  size: FalImageSize;
};

export async function composePromptFromDraft(input: {
  organizationId: string;
  brandId: string;
  draftThemeInput: string;
  draftGeneratedText: string;
  channel: DraftChannelHint;
}): Promise<ComposedPrompt> {
  const [bundle, brand] = await Promise.all([
    getBrandKitWithLists(input.brandId),
    getBrandById(input.organizationId, input.brandId),
  ]);

  const theme = sanitizeForPrompt(input.draftThemeInput, 300);
  const body = sanitizeForPrompt(input.draftGeneratedText, 600);

  // Palette: solo il color ufficiale del brand (hex). Modelli flux reagiscono
  // bene sia a hex ("primary color #a84a2d") sia a descrizioni.
  const paletteBits: string[] = [];
  if (brand?.color) paletteBits.push(`dominant brand color ${brand.color}`);

  const toneBits: string[] = [];
  if (bundle?.kit?.toneOfVoice) {
    toneBits.push(sanitizeForPrompt(bundle.kit.toneOfVoice, 200));
  }
  if (bundle?.kit?.strategicDirection) {
    toneBits.push(sanitizeForPrompt(bundle.kit.strategicDirection, 200));
  }

  // Parole bandite dal brand → le aggiungiamo come "no X, no Y" al prompt.
  const forbiddenBits: string[] = [];
  if (bundle?.forbiddenWords?.length) {
    forbiddenBits.push(
      "avoid imagery suggesting: " +
        bundle.forbiddenWords
          .slice(0, 8)
          .map((w) => w.word)
          .join(", "),
    );
  }

  const parts: string[] = [
    `High quality photograph for ${brand?.displayName ?? "the brand"}, social media use.`,
    `Subject: ${theme || body.slice(0, 200)}.`,
    body.length > 0 ? `Context: ${body.slice(0, 200)}.` : "",
    paletteBits.length > 0 ? `Palette: ${paletteBits.join(", ")}.` : "",
    toneBits.length > 0 ? `Mood: ${toneBits.join(" ")}.` : "",
    `Composition suited to ${FAL_SIZE_BY_CHANNEL[input.channel].label}.`,
    `No text, no logos, no watermarks, no fake storefronts, no human faces close-up unless specified.`,
    forbiddenBits.join(" "),
  ];

  const prompt = parts.filter((p) => p.length > 0).join(" ");
  return { prompt, size: FAL_SIZE_BY_CHANNEL[input.channel] };
}

// ────────────────────────────────────────────────────────────────────────
// Scarica un'immagine dall'URL fal e la carica nel bucket content-media.
// ────────────────────────────────────────────────────────────────────────

export async function saveFalImageToBucket(input: {
  imageUrl: string;
  organizationId: string;
  brandId: string;
  caption: string;
  tags: string[];
  uploadedBy: string;
  contentType: string;
}): Promise<MediaAsset> {
  const res = await fetch(input.imageUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Impossibile scaricare l'immagine generata (status ${res.status}).`);
  }
  const arrayBuf = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  // Normalizza il content-type: fal restituisce quasi sempre jpeg.
  const ct = input.contentType.startsWith("image/") ? input.contentType : "image/jpeg";
  const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";

  const assetId = randomUUID();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const storagePath = `media/${input.organizationId}/${input.brandId}/${yyyy}/${mm}/${assetId}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: ct, upsert: false });
  if (uploadError) {
    console.error("[fal] storage.upload fallito", {
      bucket: MEDIA_BUCKET,
      path: storagePath,
      msg: uploadError.message,
    });
    throw new Error(
      "Immagine generata ma salvataggio in libreria non riuscito. Verifica il bucket di storage.",
    );
  }

  const { data: signed, error: signError } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  if (signError || !signed) {
    await admin.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error("Immagine generata ma URL di accesso non disponibile.");
  }

  const asset = await insertMediaAsset({
    organizationId: input.organizationId,
    brandId: input.brandId,
    storagePath,
    signedUrl: signed.signedUrl,
    contentType: ct as "image/jpeg" | "image/png" | "image/webp",
    sizeBytes: bytes.byteLength,
    width: null,
    height: null,
    tags: input.tags,
    caption: input.caption.slice(0, 500),
    uploadedBy: input.uploadedBy,
  });
  return asset;
}

// ────────────────────────────────────────────────────────────────────────
// Entry point generazione anteprime / variante finale.
// ────────────────────────────────────────────────────────────────────────

export async function runFalGeneration(input: {
  modelId: FalImageModelId;
  prompt: string;
  size: FalImageSize;
  numImages: number;
}): Promise<GenerateImagesResult> {
  return generateImages({
    modelId: input.modelId,
    prompt: input.prompt,
    size: input.size,
    numImages: input.numImages,
  });
}
