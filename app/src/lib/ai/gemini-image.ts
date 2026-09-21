// RS-2: unica porta a Google Gemini image generation. Nessun altro file può
// fare fetch verso generativelanguage.googleapis.com per generazione immagini.
// Modulo m03-editorial usa questo adapter (M4-γ-patch-2) come alternativa a
// fal.ai quando IMAGE_PROVIDER=gemini.
//
// Gemini image gen nativo (gemini-3.1-flash-image) restituisce
// immagine come inlineData base64 dentro candidates[0].content.parts.
// API docs: https://ai.google.dev/api/generate-content

export type GenerateImageInput = {
  prompt: string;
  // Gemini image gen NON supporta modello/aspect ratio come parametri espliciti
  // (usa default del modello, tipicamente 1024×1024 square).
  // I parametri di fal.ai (model, aspectRatio) sono ignorati qui — l'adapter
  // ha interfaccia compatibile con fal per intercambiabilità nell'orchestratore.
  model?: string;
  aspectRatio?: string;
};

export type GenerateImageResult = {
  imageBytes: Uint8Array;
  contentType: string;
  model: string;
  costUsd: number;
  latencyMs: number;
};

export class GeminiImageConfigError extends Error {
  readonly kind = "invalid_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "GeminiImageConfigError";
  }
}
export class GeminiImageApiError extends Error {
  readonly kind = "api_error" as const;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiImageApiError";
  }
}
export class GeminiImageTimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "GeminiImageTimeoutError";
  }
}
export class GeminiImageDecodeError extends Error {
  readonly kind = "decode_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "GeminiImageDecodeError";
  }
}

const TIMEOUT_MS = 30_000;
const MODEL = "gemini-3.1-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Free tier ampio (100+ img/day). Pricing over-quota (2026):
// gemini-3.1-flash-image: ~$0.039/img. Sotto free tier costUsd=0 (non tracked lato API).
const PRICE_PER_IMAGE_USD = 0.039;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new GeminiImageConfigError("GEMINI_API_KEY non impostata (server-only).");
  }
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.prompt }] }],
        generationConfig: { responseModalities: ["Image"] },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new GeminiImageTimeoutError(`Gemini image timeout ${TIMEOUT_MS}ms`);
    }
    throw new GeminiImageApiError(0, `Gemini image fetch error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Non incapsulare upstream body (RNF-1).
    throw new GeminiImageApiError(res.status, `Gemini image error (HTTP ${res.status})`);
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[];
      };
    }[];
  };

  // Trova la parts entry con inlineData (Gemini può anche restituire text prima dell'immagine).
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData !== undefined);
  if (!imagePart || !imagePart.inlineData) {
    throw new GeminiImageDecodeError(
      "Gemini response senza inlineData in candidates[0].content.parts",
    );
  }

  const { mimeType, data } = imagePart.inlineData;
  let imageBytes: Uint8Array;
  try {
    imageBytes = Uint8Array.from(Buffer.from(data, "base64"));
  } catch (err) {
    throw new GeminiImageDecodeError(`Base64 decode fallito: ${(err as Error).message}`);
  }
  if (imageBytes.length === 0) {
    throw new GeminiImageDecodeError("Gemini image bytes vuoti");
  }

  const latencyMs = Date.now() - started;

  return {
    imageBytes,
    contentType: mimeType || "image/png",
    model: MODEL,
    costUsd: PRICE_PER_IMAGE_USD, // Nota: free tier non tracked → sovrastima teorica
    latencyMs,
  };
}
