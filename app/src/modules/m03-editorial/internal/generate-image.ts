// M03 — Orchestrazione generazione immagine (M4-γ RF-4.5).
// Chiama adapter immagini (fal.ai o gemini) + upload Supabase Storage + cleanup file precedente.
// Switch provider via IMAGE_PROVIDER env (default: gemini). RS-2, M4-γ-patch-2.

import { getAdminClient } from "@/lib/db/admin";
import {
  generateImage as generateImageFal,
  FalConfigError,
  FalApiError,
  FalTimeoutError,
  FalDownloadError,
  type FluxModel,
} from "@/lib/ai/fal";
import {
  generateImage as generateImageGemini,
  GeminiImageConfigError,
  GeminiImageApiError,
  GeminiImageTimeoutError,
  GeminiImageDecodeError,
} from "@/lib/ai/gemini-image";
import { getDraftImagePath } from "./content-drafts-repo";

const BUCKET = "content-media";

export type RunGenerateImageInput = {
  organizationId: string;
  draftId: string;
  prompt: string;
  model: FluxModel;
};

export type RunGenerateImageOutput =
  | {
      ok: true;
      imagePath: string;
      costUsd: number;
      model: string;
      generatedAt: string;
    }
  | { ok: false; error: string };

export async function runGenerateImage(
  input: RunGenerateImageInput,
): Promise<RunGenerateImageOutput> {
  const provider = (process.env["IMAGE_PROVIDER"] ?? "gemini").toLowerCase();

  // 1. Call image adapter con fallback graceful (RNF-9)
  let result: { imageBytes: Uint8Array; contentType: string; model: string; costUsd: number };
  try {
    if (provider === "fal") {
      result = await generateImageFal({ prompt: input.prompt, model: input.model });
    } else {
      // Default: gemini (finché fal.ai TOP_UP non è risolto).
      result = await generateImageGemini({ prompt: input.prompt });
    }
  } catch (err) {
    // fal.ai errors
    if (err instanceof FalConfigError) {
      return { ok: false, error: "Servizio immagini AI non configurato (FAL_API_KEY mancante)." };
    }
    if (err instanceof FalTimeoutError) {
      return { ok: false, error: "Servizio immagini AI non disponibile (timeout). Riprova." };
    }
    if (err instanceof FalDownloadError) {
      return { ok: false, error: `Download immagine fallito: ${(err as Error).message}` };
    }
    if (err instanceof FalApiError) {
      return { ok: false, error: `Servizio immagini AI errore ${err.status}. Riprova.` };
    }
    // gemini-image errors
    if (err instanceof GeminiImageConfigError) {
      return {
        ok: false,
        error: "Servizio immagini AI non configurato (GEMINI_API_KEY mancante).",
      };
    }
    if (err instanceof GeminiImageTimeoutError) {
      return { ok: false, error: "Servizio immagini AI non disponibile (timeout). Riprova." };
    }
    if (err instanceof GeminiImageDecodeError) {
      return { ok: false, error: `Decode immagine fallito: ${(err as Error).message}` };
    }
    if (err instanceof GeminiImageApiError) {
      return { ok: false, error: `Servizio immagini AI errore ${err.status}. Riprova.` };
    }
    throw err;
  }

  // 2. Fetch path immagine precedente (se esiste) per cleanup post-upload
  const previousPath = await getDraftImagePath(input.draftId, input.organizationId);

  // 3. Upload nuovo file (upsert overwrite se stesso path)
  const newPath = `${input.organizationId}/${input.draftId}.jpg`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(newPath, result.imageBytes, {
      contentType: result.contentType,
      upsert: true,
    });
  if (uploadError) {
    return { ok: false, error: `Upload Storage fallito: ${uploadError.message}` };
  }

  // 4. Cleanup file precedente SOLO se path diverso (upsert su stesso path già sovrascrive)
  if (previousPath && previousPath !== newPath) {
    // Best-effort: se remove fallisce logghiamo warning ma non blocchiamo l'operazione
    const { error: removeError } = await admin.storage.from(BUCKET).remove([previousPath]);
    if (removeError) {
      console.warn(
        `[m03] Cleanup file precedente fallito (${previousPath}): ${removeError.message}`,
      );
    }
  }

  return {
    ok: true,
    imagePath: newPath,
    costUsd: result.costUsd,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}
