// M03 — Orchestrazione generazione immagine (M4-γ RF-4.5).
// Chiama fal.ai adapter + upload Supabase Storage + cleanup file precedente.

import { getAdminClient } from "@/lib/db/admin";
import {
  generateImage,
  FalConfigError,
  FalApiError,
  FalTimeoutError,
  FalDownloadError,
  type FluxModel,
} from "@/lib/ai/fal";
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
  // 1. Call fal.ai (con fallback graceful RNF-9)
  let result;
  try {
    result = await generateImage({ prompt: input.prompt, model: input.model });
  } catch (err) {
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
