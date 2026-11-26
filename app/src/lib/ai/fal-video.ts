// Generazione video fal.ai (image-to-video). Pattern queue async per gestire
// render che durano 30-120s (oltre il limite Vercel Functions sincrone).
//
// Flusso:
//   submitVideoJob({ imageUrl, prompt }) → requestId
//   getVideoJobStatus(requestId) → { status, videoUrl? }
//
// Il caller (fal-video-actions.ts) salva la row in creatomate_renders o in
// una tabella dedicata e polla fino a succeeded.

import "server-only";
import { fal } from "@fal-ai/client";
import { FAL_VIDEO_MODEL, FAL_VIDEO_COST_USD, FAL_VIDEO_DEFAULT_DURATION_S } from "./fal-config";
import { FalConfigError, FalApiError, FalRateLimitError } from "./fal";

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const key = process.env["FAL_KEY"];
  if (!key || !key.trim()) throw new FalConfigError();
  fal.config({ credentials: key });
  configured = true;
}

export type SubmitVideoInput = {
  imageUrl: string;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
};

export type SubmitVideoResult = {
  requestId: string;
  estimatedCostUsd: number;
};

export async function submitVideoJob(input: SubmitVideoInput): Promise<SubmitVideoResult> {
  ensureConfigured();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { request_id } = (await fal.queue.submit(FAL_VIDEO_MODEL, {
      input: {
        prompt: input.prompt.slice(0, 2000),
        image_url: input.imageUrl,
        duration: input.durationSeconds ?? FAL_VIDEO_DEFAULT_DURATION_S,
        aspect_ratio: input.aspectRatio ?? "9:16",
      },
    })) as { request_id: string };
    if (!request_id) {
      throw new FalApiError(502, "fal.ai video non ha restituito request_id.");
    }
    return { requestId: request_id, estimatedCostUsd: FAL_VIDEO_COST_USD };
  } catch (err) {
    if (err instanceof FalConfigError || err instanceof FalApiError) throw err;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    const status = typeof anyErr?.status === "number" ? anyErr.status : 0;
    if (status === 401 || status === 403) throw new FalConfigError("Chiave fal.ai non valida.");
    if (status === 429) throw new FalRateLimitError();
    throw new FalApiError(
      status || 500,
      `fal.ai video submit: ${anyErr?.message ?? "errore sconosciuto"}`,
    );
  }
}

export type VideoJobStatus =
  | { status: "queued" | "in_progress" }
  | { status: "succeeded"; videoUrl: string; durationSeconds?: number }
  | { status: "failed"; errorMessage: string };

export async function getVideoJobStatus(requestId: string): Promise<VideoJobStatus> {
  ensureConfigured();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (await fal.queue.status(FAL_VIDEO_MODEL, { requestId })) as any;
    const st = String(s?.status ?? "").toUpperCase();
    if (st === "COMPLETED" || st === "OK") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fal.queue.result(FAL_VIDEO_MODEL, { requestId })) as any;
      const data = result?.data ?? result;
      const videoUrl = data?.video?.url ?? data?.url;
      if (!videoUrl) {
        return { status: "failed", errorMessage: "fal.ai video: output url mancante." };
      }
      const duration = typeof data?.duration === "number" ? data.duration : undefined;
      return duration !== undefined
        ? { status: "succeeded", videoUrl, durationSeconds: duration }
        : { status: "succeeded", videoUrl };
    }
    if (st === "FAILED" || st === "ERROR") {
      const errMsg = String(s?.error?.message ?? s?.error ?? "Render video fallito");
      return { status: "failed", errorMessage: errMsg };
    }
    if (st === "IN_PROGRESS") return { status: "in_progress" };
    return { status: "queued" };
  } catch (err) {
    // Se non è un errore terminale (401/404), trattalo come in progress per
    // non terminare prematuramente il polling su glitch transitori.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    const status = typeof anyErr?.status === "number" ? anyErr.status : 0;
    if (status === 401 || status === 403) throw new FalConfigError();
    if (status === 404) {
      return { status: "failed", errorMessage: "Job fal.ai non trovato." };
    }
    return { status: "in_progress" };
  }
}
