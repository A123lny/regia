// RS-2: unica porta a Google Gemini API. Nessun altro file può fare fetch verso
// generativelanguage.googleapis.com. Il modulo m03-editorial usa Gemini per il
// suggest prompt immagine (M4-γ-patch), Claude resta per generateText post (F1.5a).
//
// Google Gemini non ha SDK TypeScript ufficiale maturo — usiamo fetch nativo.
// API docs: https://ai.google.dev/api/generate-content

export type GenerateTextInput = {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
};

export type GenerateTextResult = {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

export class GeminiConfigError extends Error {
  readonly kind = "invalid_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}
export class GeminiApiError extends Error {
  readonly kind = "api_error" as const;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}
export class GeminiTimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "GeminiTimeoutError";
  }
}
export class GeminiRateLimitError extends Error {
  readonly kind = "rate_limit" as const;
  constructor(readonly retryAfterSec: number | null) {
    super(`Gemini rate limit${retryAfterSec ? ` (retry after ${retryAfterSec}s)` : ""}`);
    this.name = "GeminiRateLimitError";
  }
}

const TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = "gemini-1.5-flash";

// Pricing 2026-09 (aggiornare quando Gemini cambia listino, verifica ~annuale
// su https://ai.google.dev/pricing). Free tier: 1500 req/day.
// Sotto free tier: costUsd = 0.
const PRICE_INPUT_PER_M_USD = 0.075;
const PRICE_OUTPUT_PER_M_USD = 0.3;

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new GeminiConfigError("GEMINI_API_KEY non impostata (server-only).");
  }
  const model = DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.userMessage }] }],
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        generationConfig: {
          maxOutputTokens: input.maxTokens ?? 300,
          temperature: input.temperature ?? 0.7,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new GeminiTimeoutError(`Gemini timeout ${TIMEOUT_MS}ms`);
    }
    throw new GeminiApiError(0, `Gemini fetch error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    const retryHeader = res.headers.get("retry-after");
    const retry = retryHeader ? Number(retryHeader) : null;
    throw new GeminiRateLimitError(Number.isFinite(retry) ? retry : null);
  }

  if (!res.ok) {
    // Non incapsulare upstream body per RNF-1 (potrebbe contenere echo prompt).
    throw new GeminiApiError(res.status, `Gemini error (HTTP ${res.status})`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiApiError(500, "Gemini response senza candidates[0].content.parts[0].text");
  }

  const tokensIn = json.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = json.usageMetadata?.candidatesTokenCount ?? 0;
  const costUsd =
    (tokensIn * PRICE_INPUT_PER_M_USD) / 1_000_000 +
    (tokensOut * PRICE_OUTPUT_PER_M_USD) / 1_000_000;
  const latencyMs = Date.now() - started;

  return { text, model, tokensIn, tokensOut, costUsd, latencyMs };
}
