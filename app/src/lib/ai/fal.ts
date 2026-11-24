// Wrapper server-only su @fal-ai/client con retry esponenziale, mapping
// errori leggibili in italiano e timeout. FAL_KEY è letta solo qui lato
// server: non deve mai finire nel bundle browser.

import "server-only";
import { fal } from "@fal-ai/client";
import type { FalImageModelId, FalImageSize } from "./fal-config";
import { FAL_COST_USD } from "./fal-config";

// ────────────────────────────────────────────────────────────────────────
// Errori tipati (mapping testo IT lo fa chi consuma).
// ────────────────────────────────────────────────────────────────────────

export class FalConfigError extends Error {
  constructor(message = "Chiave fal.ai non impostata. Contatta l'amministratore.") {
    super(message);
    this.name = "FalConfigError";
  }
}

export class FalRateLimitError extends Error {
  constructor(
    message = "fal.ai ha rifiutato la richiesta (limite di frequenza). Riprova tra un minuto.",
  ) {
    super(message);
    this.name = "FalRateLimitError";
  }
}

export class FalContentRejectedError extends Error {
  constructor(
    message = "Il contenuto è stato rifiutato dai filtri di sicurezza di fal.ai. Prova con un prompt diverso.",
  ) {
    super(message);
    this.name = "FalContentRejectedError";
  }
}

export class FalTimeoutError extends Error {
  constructor(message = "La generazione immagine ha superato il tempo massimo. Riprova.") {
    super(message);
    this.name = "FalTimeoutError";
  }
}

export class FalApiError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `fal.ai ha risposto con errore ${status}. Riprova tra qualche minuto.`);
    this.name = "FalApiError";
    this.status = status;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Configurazione client (chiave presa da env, nessun fallback).
// ────────────────────────────────────────────────────────────────────────

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const key = process.env["FAL_KEY"];
  if (!key || key.trim().length === 0) {
    throw new FalConfigError();
  }
  fal.config({ credentials: key });
  configured = true;
}

export function isFalKeyPresent(): boolean {
  const key = process.env["FAL_KEY"];
  return !!key && key.trim().length > 0;
}

// ────────────────────────────────────────────────────────────────────────
// Generazione immagini (flux/schnell, flux-pro/v1.1).
// ────────────────────────────────────────────────────────────────────────

export type GenerateImagesInput = {
  modelId: FalImageModelId;
  prompt: string;
  size: FalImageSize;
  numImages: number;
  // Se true usa seed deterministici crescenti per riproducibilità anteprime.
  // Useful quando l'utente rigenera dalla stessa seed set per confronti.
  seed?: number;
};

export type GenerateImagesResult = {
  images: Array<{ url: string; width: number; height: number; contentType: string }>;
  modelId: FalImageModelId;
  // Costo in USD stimato dal listino (fal non espone sempre un costo per request).
  estimatedCostUsd: number;
  latencyMs: number;
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 800;
const PER_CALL_TIMEOUT_MS = 90_000; // flux-pro può servire ~15s; margine ampio

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

type FalErrorShape = { status?: number; body?: { detail?: unknown }; message?: string };

function describeError(err: unknown): { status: number; message: string } {
  const e = err as FalErrorShape;
  const status = typeof e?.status === "number" ? e.status : 0;
  const detail = e?.body?.detail;
  const message = typeof detail === "string" ? detail : (e?.message ?? "Errore sconosciuto");
  return { status, message };
}

export async function generateImages(input: GenerateImagesInput): Promise<GenerateImagesResult> {
  ensureConfigured();
  const start = Date.now();

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await Promise.race([
        fal.subscribe(input.modelId, {
          input: {
            prompt: input.prompt,
            image_size: { width: input.size.width, height: input.size.height },
            num_images: input.numImages,
            enable_safety_checker: true,
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
          },
          logs: false,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new FalTimeoutError()), PER_CALL_TIMEOUT_MS),
        ),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (result as any)?.data ?? result;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawImages = (data?.images ?? []) as Array<any>;
      const images = rawImages
        .filter((im) => im && typeof im.url === "string")
        .map((im) => ({
          url: im.url as string,
          width: Number(im.width ?? input.size.width),
          height: Number(im.height ?? input.size.height),
          contentType: String(im.content_type ?? "image/jpeg"),
        }));
      if (images.length === 0) {
        // fal può rifiutare silenziosamente immagini NSFW restituendo list vuota
        // o has_nsfw_concepts=[true]. Lo trattiamo come content rejected.
        const nsfw = (data?.has_nsfw_concepts ?? []) as Array<boolean>;
        if (Array.isArray(nsfw) && nsfw.some(Boolean)) {
          throw new FalContentRejectedError();
        }
        throw new FalApiError(502, "fal.ai non ha restituito immagini.");
      }
      return {
        images,
        modelId: input.modelId,
        estimatedCostUsd: FAL_COST_USD[input.modelId] * images.length,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      if (err instanceof FalTimeoutError || err instanceof FalContentRejectedError) {
        throw err;
      }
      lastErr = err;
      const { status, message } = describeError(err);
      // 429 e 5xx: retry con backoff esponenziale.
      if (isRetryableStatus(status) && attempt < MAX_ATTEMPTS) {
        await wait(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }
      // 401/403: chiave mancante o revocata.
      if (status === 401 || status === 403) {
        throw new FalConfigError("Chiave fal.ai non valida o revocata.");
      }
      // 400/422 spesso significa prompt rifiutato dai filtri.
      if (status === 400 || status === 422) {
        throw new FalContentRejectedError();
      }
      // 429 dopo esaurimento retry: errore dedicato.
      if (status === 429) {
        throw new FalRateLimitError();
      }
      // Fallback generico.
      throw new FalApiError(status || 500, message);
    }
  }
  // Non raggiungibile ma TypeScript vuole il return.
  throw lastErr instanceof Error ? lastErr : new FalApiError(500);
}
