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
import { generateText as geminiGenerateText } from "@/lib/ai/gemini";
import { assertBudgetOk, AiBudgetExceededError, logSpend } from "@/modules/m11-admin/public";
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
  /** URL del LoRA addestrato sul brand (se valorizzato in brand_kits.lora_model_url).
   * Il caller lo passa a generateImages con modelId=fal-ai/flux-lora per applicare
   * lo stile; null → usa il modello base (schnell/dev). */
  loraUrl: string | null;
};

/**
 * Chiede a Gemini di estrarre dal testo italiano della bozza una SOLA
 * descrizione VISIVA in inglese, zero branding, zero strategia, pronta per
 * un modello text-to-image.
 *
 * Costo: ~500 token input + ~220 token output su Gemini 2.5 Flash =
 * ~$0.0001 per chiamata (free tier copre fino a 1500 chiamate/giorno).
 * Comunque passa dal gate RS-4 budget: se "gemini" ha esaurito il tetto
 * di spesa, la chiamata viene saltata e il caller fa fallback deterministico.
 *
 * logSpend con i token effettivi dopo la chiamata (parity con generateText
 * di m03 e con fal.ai action).
 */
async function describeVisualFromDraftIT(input: {
  organizationId: string;
  brandId: string;
  italianText: string;
}): Promise<string | null> {
  const trimmed = input.italianText.trim();
  if (trimmed.length === 0) return null;

  // Budget gate: stima pessimistica $0.0005 per chiamata (5x la media).
  // Se non entra nel budget "gemini", salta: il caller farà fallback.
  try {
    await assertBudgetOk(input.organizationId, "gemini", 0.0005);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return null;
    // Altri errori: non blocchiamo la generazione immagine, fallback.
    return null;
  }

  let r;
  try {
    r = await geminiGenerateText({
      systemPrompt:
        "You transform an Italian marketing draft into ONE concise English visual " +
        "description (max 60 words) suitable for a text-to-image model. " +
        "Describe ONLY what the photograph should show: subject, setting, lighting, " +
        "mood. NEVER include: brand names, logos, signs, storefronts, written text " +
        "of any kind, slogans, prices, people's faces as close-ups, marketing " +
        "strategy, positioning, or any Italian words. Output the description only, " +
        "no preamble, no quotes, no list.",
      userMessage: trimmed.slice(0, 1500),
      maxTokens: 220,
      responseMimeType: "text/plain",
    });
  } catch {
    return null;
  }

  // Log della spesa effettiva (token reali ritornati dal wrapper).
  try {
    await logSpend({
      organizationId: input.organizationId,
      brandId: input.brandId,
      category: "gemini",
      action: "gemini.fal_visual_description",
      costUsd: r.costUsd,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      targetType: "brand",
      targetId: input.brandId,
    });
  } catch {
    // best-effort: non bloccare se il logSpend fallisce.
  }

  const out = r.text.trim().replace(/^["']+|["']+$/g, "");
  if (out.length < 10) return null;
  return out.slice(0, 500);
}

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

  // Prima scelta: descrizione visiva in INGLESE dedotta dal corpo della
  // bozza (Gemini). Fallback: subject = theme sanitizzato (senza il corpo,
  // che tipicamente contiene strategia / CTA / brand).
  const italianText = `${input.draftThemeInput}\n\n${input.draftGeneratedText}`.trim();
  const visualEN = await describeVisualFromDraftIT({
    organizationId: input.organizationId,
    brandId: input.brandId,
    italianText,
  });
  const subject =
    visualEN ?? sanitizeForPrompt(input.draftThemeInput || input.draftGeneratedText, 200);

  // Palette: solo hex del brand (modelli flux rispondono bene a #RRGGBB).
  // Nessun brand name nel prompt: eliminata la riga "photograph for <brand>".
  // Nessun strategicDirection o toneOfVoice: sono testi di posizionamento,
  // non istruzioni visive — l'immagine deve dipendere dal contenuto della
  // bozza, non dalla strategia commerciale.
  const paletteBit = brand?.color ? `Dominant color palette: ${brand.color}.` : "";

  // Stile foto personalizzato del brand (imageStyle - richiesta utente
  // 2026-11-27). Sostituisce il baseline "Photorealistic photograph,
  // natural light, editorial quality" quando compilato. Scritto in inglese
  // perché va direttamente al modello di immagini.
  const styleBit =
    (bundle?.kit.imageStyle ?? "").trim().length > 0
      ? sanitizeForPrompt(bundle?.kit.imageStyle ?? "", 500)
      : "Photorealistic photograph, natural light, editorial quality";

  // Parole bandite (brand_forbidden_words) + soggetti vietati (imageSubjects
  // - richiesta utente 2026-11-27). I primi sono "parole dal copy" vietate
  // e li convertiamo in visual-avoid; i secondi sono già esplicitamente
  // visuali.
  const forbiddenCopyWords = (bundle?.forbiddenWords ?? [])
    .slice(0, 8)
    .map((w) => w.word.trim())
    .filter((w) => w.length > 0);
  const forbiddenSubjects = (bundle?.kit.forbiddenSubjects ?? [])
    .slice(0, 20)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const allForbidden = [...forbiddenSubjects, ...forbiddenCopyWords];
  const forbiddenBit =
    allForbidden.length > 0 ? `Avoid imagery suggesting: ${allForbidden.join(", ")}.` : "";

  const parts: string[] = [
    `${styleBit}.`,
    `Subject: ${subject}.`,
    paletteBit,
    `Composition suited to ${FAL_SIZE_BY_CHANNEL[input.channel].label}.`,
    // Vincoli negativi forti - niente scritte né segnaletica né loghi finti.
    "No text, no letters, no words, no logos, no signage, no brand names, no watermark, no storefront names, no price tags.",
    forbiddenBit,
  ];

  const prompt = parts.filter((p) => p.length > 0).join(" ");
  return {
    prompt,
    size: FAL_SIZE_BY_CHANNEL[input.channel],
    loraUrl: bundle?.kit.loraModelUrl ?? null,
  };
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
  /** URL safetensors LoRA (opzionale). Valido solo se modelId=fal-ai/flux-lora. */
  loraUrl?: string;
}): Promise<GenerateImagesResult> {
  return generateImages({
    modelId: input.modelId,
    prompt: input.prompt,
    size: input.size,
    numImages: input.numImages,
    ...(input.loraUrl ? { loraUrl: input.loraUrl } : {}),
  });
}
