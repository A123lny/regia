// Wrapper server-only su @fal-ai/client con retry esponenziale, mapping
// errori leggibili in italiano e timeout. FAL_KEY è letta solo qui lato
// server: non deve mai finire nel bundle browser.

import "server-only";
import { fal } from "@fal-ai/client";
import type { FalImageModelId, FalImageSize } from "./fal-config";
import { FAL_COST_USD } from "./fal-config";

// ────────────────────────────────────────────────────────────────────────
// Errori tipati — base class con `possiblyCharged` + `estimatedCostUsd`
// (accumulato across retry quando il tentativo era addebitabile).
// Il chiamante in fal-actions.ts legge questi campi per loggare lo spent
// anche sui percorsi di errore (sibling-path spend-cap bypass closure).
// ────────────────────────────────────────────────────────────────────────

export class FalError extends Error {
  possiblyCharged: boolean;
  /** Costo stimato totale: su error post-retry include la somma dei
   *  tentativi addebitabili (5xx post-accettazione, empty response). */
  estimatedCostUsd: number;
  constructor(message: string, possiblyCharged: boolean, estimatedCostUsd: number) {
    super(message);
    this.name = "FalError";
    this.possiblyCharged = possiblyCharged;
    this.estimatedCostUsd = estimatedCostUsd;
  }
}

export class FalConfigError extends FalError {
  constructor(
    message = "Chiave fal.ai non impostata. Contatta l'amministratore.",
    accumulatedCostUsd = 0,
  ) {
    // La chiave rotta per il tentativo corrente non addebita, ma i retry
    // 5xx precedenti sì — propaga l'accumulato.
    super(message, accumulatedCostUsd > 0, accumulatedCostUsd);
    this.name = "FalConfigError";
  }
}

export class FalRateLimitError extends FalError {
  constructor(
    accumulatedCostUsd = 0,
    message = "fal.ai ha rifiutato la richiesta (limite di frequenza). Riprova tra un minuto.",
  ) {
    // Rate limit = pre-accettazione per il tentativo corrente, ma i retry
    // precedenti possono aver addebitato (es. 502 → retry → 429).
    super(message, accumulatedCostUsd > 0, accumulatedCostUsd);
    this.name = "FalRateLimitError";
  }
}

export class FalContentRejectedError extends FalError {
  constructor(
    possiblyCharged = false,
    estimatedCostUsd = 0,
    message = "Il contenuto è stato rifiutato dai filtri di sicurezza di fal.ai. Prova con un prompt diverso.",
  ) {
    super(message, possiblyCharged, estimatedCostUsd);
    this.name = "FalContentRejectedError";
  }
}

export class FalTimeoutError extends FalError {
  constructor(
    estimatedCostUsd = 0,
    message = "La generazione immagine ha superato il tempo massimo. Riprova.",
  ) {
    // Timeout = la richiesta è stata accettata, il job può essere in corso: addebitato.
    super(message, true, estimatedCostUsd);
    this.name = "FalTimeoutError";
  }
}

export class FalApiError extends FalError {
  status: number;
  constructor(status: number, message?: string, estimatedCostUsd = 0) {
    // 5xx = fal ha processato: addebitato. 401/403/429 = pre-accettazione, 0.
    super(
      message ?? `fal.ai ha risposto con errore ${status}. Riprova tra qualche minuto.`,
      status >= 500 || estimatedCostUsd > 0,
      estimatedCostUsd,
    );
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
  const perCallEstimate = FAL_COST_USD[input.modelId] * input.numImages;
  // Accumulatore cross-retry: ogni tentativo che era addebitabile (5xx dopo
  // accettazione o empty response = fal ha processato) viene sommato. Il
  // chiamante vedrà il totale in error.estimatedCostUsd e lo logga una volta.
  let accumulatedChargedCost = 0;

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
          setTimeout(
            () => reject(new FalTimeoutError(accumulatedChargedCost + perCallEstimate)),
            PER_CALL_TIMEOUT_MS,
          ),
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
        // fal ha PROCESSATO la request (siamo qui dopo subscribe success).
        // NSFW filtered o response vuota → addebitato. NON retry: non sarebbe
        // transiente, rischierebbe di addebitare N volte lo stesso prompt.
        const totalCharged = accumulatedChargedCost + perCallEstimate;
        const nsfw = (data?.has_nsfw_concepts ?? []) as Array<boolean>;
        if (Array.isArray(nsfw) && nsfw.some(Boolean)) {
          throw new FalContentRejectedError(true, totalCharged);
        }
        throw new FalApiError(502, "fal.ai non ha restituito immagini.", totalCharged);
      }
      return {
        images,
        modelId: input.modelId,
        // Includo anche l'eventuale spesa "in più" dei tentativi precedenti:
        // il successo finale non annulla gli addebiti dei retry.
        estimatedCostUsd: FAL_COST_USD[input.modelId] * images.length + accumulatedChargedCost,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      // Qualsiasi errore della nostra libreria (già enriched con accumulated
      // e possiblyCharged corretto) bypassa il loop senza ricontare.
      // Importante: cattura anche il FalApiError(502) throwato quando images
      // è vuota, altrimenti il catch lo riprocesserebbe perdendo totalCharged.
      if (err instanceof FalError) throw err;
      // Tradeoff: usiamo lo status HTTP come approssimazione di "fal ha
      // accettato la request" (status>=500 || status===0 = sì). Se vogliamo
      // fare meglio bisogna hookare `onEnqueue` del client fal (se esposto
      // da SDK v1.x — da verificare) e, su retry dopo accettazione, invece
      // di riemettere, riprendere il polling dello stesso requestId per non
      // addebitare due volte. Non implementato: su fal.subscribe gli errori
      // post-accettazione vengono già normalizzati a 5xx o empty-response.
      lastErr = err;
      const { status, message } = describeError(err);
      const retryable = isRetryableStatus(status);
      // 5xx = request accettata e processata ma errore server-side: addebitato.
      // status 0 = errore di rete / unclassified: conservativo, trattato come
      // potenzialmente addebitato (fal potrebbe aver ricevuto la request).
      // 429 (rate limit) = pre-accettazione: NON addebitato per quel tentativo.
      const chargedThisAttempt = status >= 500 || status === 0;
      if (chargedThisAttempt) {
        accumulatedChargedCost += perCallEstimate;
      }
      if (retryable && attempt < MAX_ATTEMPTS) {
        await wait(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }
      // Da qui in poi, nessun retry: emettere errore terminale che preserva
      // accumulatedChargedCost accumulato dai tentativi precedenti addebitabili.
      if (status === 401 || status === 403) {
        throw new FalConfigError("Chiave fal.ai non valida o revocata.", accumulatedChargedCost);
      }
      if (status === 400 || status === 422) {
        // Prompt rifiutato in validation: pre-accettazione per questo tentativo,
        // ma i retry precedenti possono aver addebitato (possiblyCharged auto).
        throw new FalContentRejectedError(accumulatedChargedCost > 0, accumulatedChargedCost);
      }
      if (status === 429) {
        throw new FalRateLimitError(accumulatedChargedCost);
      }
      // Fallback generico 5xx o status 0.
      throw new FalApiError(status || 500, message, accumulatedChargedCost);
    }
  }
  // Non raggiungibile: il loop o ritorna o throwa. Difensivo per TypeScript.
  throw lastErr instanceof Error
    ? lastErr
    : new FalApiError(500, undefined, accumulatedChargedCost);
}
