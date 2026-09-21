// RS-2: unica porta a fal.ai API. Nessun altro file può fare fetch verso fal.run.
// Il modulo m03-editorial passa da qui per generazione immagini (RF-4.5).
//
// fal.ai non ha SDK TypeScript maturo ufficiale — usiamo fetch nativo.
// API docs: https://fal.ai/models/fal-ai/flux/dev, https://fal.ai/models/fal-ai/flux/schnell

export type FluxModel = "flux-dev" | "flux-schnell";
export type FluxAspectRatio = "square_hd" | "portrait_16_9" | "landscape_16_9";

export type GenerateImageInput = {
  prompt: string;
  model?: FluxModel;
  aspectRatio?: FluxAspectRatio;
};

export type GenerateImageResult = {
  imageBytes: Uint8Array;
  contentType: string;
  model: string;
  costUsd: number;
  latencyMs: number;
};

export class FalConfigError extends Error {
  readonly kind = "invalid_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "FalConfigError";
  }
}
export class FalApiError extends Error {
  readonly kind = "api_error" as const;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FalApiError";
  }
}
export class FalTimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "FalTimeoutError";
  }
}
export class FalDownloadError extends Error {
  readonly kind = "download_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "FalDownloadError";
  }
}

const GEN_TIMEOUT_MS = 20_000; // per la generation call
const DOWNLOAD_TIMEOUT_MS = 10_000; // per il download bytes

// Pricing FLUX 2026-09 (aggiornare quando fal.ai cambia listino, verifica ~annuale su https://fal.ai/pricing).
const PRICE_PER_IMAGE_USD: Record<FluxModel, number> = {
  "flux-dev": 0.025,
  "flux-schnell": 0.003,
};

const MODEL_ENDPOINT: Record<FluxModel, string> = {
  "flux-dev": "https://fal.run/fal-ai/flux/dev",
  "flux-schnell": "https://fal.run/fal-ai/flux/schnell",
};

const MODEL_STEPS: Record<FluxModel, number> = {
  "flux-dev": 28,
  "flux-schnell": 4,
};

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const apiKey = process.env["FAL_API_KEY"];
  if (!apiKey) {
    throw new FalConfigError("FAL_API_KEY non impostata (server-only).");
  }
  const model = input.model ?? "flux-dev";
  const aspectRatio = input.aspectRatio ?? "square_hd";
  const endpoint = MODEL_ENDPOINT[model];
  const started = Date.now();

  // 1. Generation call
  const genController = new AbortController();
  const genTimer = setTimeout(() => genController.abort(), GEN_TIMEOUT_MS);

  let genRes: Response;
  try {
    genRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        image_size: aspectRatio,
        num_inference_steps: MODEL_STEPS[model],
        num_images: 1,
      }),
      signal: genController.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new FalTimeoutError(`fal.ai timeout ${GEN_TIMEOUT_MS}ms`);
    }
    throw new FalApiError(0, `fal.ai fetch error: ${(err as Error).message}`);
  } finally {
    clearTimeout(genTimer);
  }

  if (!genRes.ok) {
    // Non incapsulare upstream body per RNF-1 (potrebbe contenere echo prompt / dettagli interni).
    throw new FalApiError(genRes.status, `fal.ai error (HTTP ${genRes.status})`);
  }

  const json = (await genRes.json()) as {
    images?: { url: string; width: number; height: number }[];
    timings?: { inference: number };
  };
  const imageUrl = json.images?.[0]?.url;
  if (!imageUrl) {
    throw new FalApiError(500, "fal.ai response senza images[0].url");
  }

  // 2. Download bytes dell'immagine
  const dlController = new AbortController();
  const dlTimer = setTimeout(() => dlController.abort(), DOWNLOAD_TIMEOUT_MS);

  let dlRes: Response;
  try {
    dlRes = await fetch(imageUrl, { signal: dlController.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new FalDownloadError(`fal.ai download timeout ${DOWNLOAD_TIMEOUT_MS}ms`);
    }
    throw new FalDownloadError(`fal.ai download error: ${(err as Error).message}`);
  } finally {
    clearTimeout(dlTimer);
  }

  if (!dlRes.ok) {
    throw new FalDownloadError(`fal.ai download HTTP ${dlRes.status}`);
  }

  const buf = await dlRes.arrayBuffer();
  const imageBytes = new Uint8Array(buf);
  const contentType = dlRes.headers.get("content-type") ?? "image/jpeg";

  const latencyMs = Date.now() - started;
  const costUsd = PRICE_PER_IMAGE_USD[model];

  return { imageBytes, contentType, model, costUsd, latencyMs };
}
