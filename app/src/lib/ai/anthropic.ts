// RS-2: unico punto di accesso all'SDK Anthropic. Nessun altro file può
// importare @anthropic-ai/sdk direttamente. Il modulo m03-editorial (e futuri
// M6/M8/M11 che generano testo) passa da qui.
//
// F1.5a: solo generateText sync, no streaming, no tool_use, no retry automatico.
// Il retry sync avvelena i costi in caso di 429; verrà aggiunto quando il flusso
// sarà spostato in coda BullMQ (F1.5b+/M5, RS-4).

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | undefined;

function getClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new AiConfigError("ANTHROPIC_API_KEY non impostata (server-only).");
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export type GenerateTextInput = {
  systemPrompt: string;
  userMessage: string;
  model?: string;
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

export class AiConfigError extends Error {
  readonly kind = "invalid_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}
export class AiTimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "AiTimeoutError";
  }
}
export class AiRateLimitError extends Error {
  readonly kind = "rate_limit" as const;
  constructor(readonly retryAfterSec: number | null) {
    super(`rate limit${retryAfterSec ? ` (retry after ${retryAfterSec}s)` : ""}`);
    this.name = "AiRateLimitError";
  }
}
export class AiApiError extends Error {
  readonly kind = "api_error" as const;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

/**
 * Risposta troncata al limite maxOutputTokens. Porta l'usage effettivo cosi'
 * i caller possono loggare la spesa anche sul path di errore (non perdiamo
 * il costo reale della chiamata nel ledger).
 */
export class AiMaxTokensError extends Error {
  readonly kind = "max_tokens" as const;
  constructor(
    readonly model: string,
    readonly tokensIn: number,
    readonly tokensOut: number,
    readonly costUsd: number,
    readonly latencyMs: number,
    message: string,
  ) {
    super(message);
    this.name = "AiMaxTokensError";
  }
}

const TIMEOUT_MS = 30_000;

// Pricing Claude Sonnet 4.6 al 2026-09. Aggiornare quando cambia.
// Fonte: https://www.anthropic.com/pricing
const PRICE_INPUT_PER_M_USD = 3.0;
const PRICE_OUTPUT_PER_M_USD = 15.0;

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const client = getClient();
  const model = input.model ?? "claude-sonnet-4-6";
  const started = Date.now();

  const call = client.messages.create({
    model,
    max_tokens: input.maxTokens ?? 500,
    temperature: input.temperature ?? 0.7,
    system: input.systemPrompt,
    messages: [{ role: "user", content: input.userMessage }],
  });

  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new AiTimeoutError(`Anthropic timeout ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
  );

  let response: Awaited<typeof call>;
  try {
    response = await Promise.race([call, timeout]);
  } catch (err) {
    if (err instanceof AiTimeoutError) throw err;
    // SDK Anthropic typed errors: identificare 429 e altri.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    if (e?.status === 429) {
      const retryHeader = e?.headers?.["retry-after"];
      const retry = retryHeader ? Number(retryHeader) : null;
      throw new AiRateLimitError(Number.isFinite(retry) ? retry : null);
    }
    throw new AiApiError(e?.status ?? 500, e?.message ?? "Anthropic API error");
  }

  const latencyMs = Date.now() - started;
  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const costUsd =
    (tokensIn * PRICE_INPUT_PER_M_USD) / 1_000_000 +
    (tokensOut * PRICE_OUTPUT_PER_M_USD) / 1_000_000;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AiApiError(500, "Risposta Anthropic senza blocco text");
  }

  return { text: textBlock.text, model, tokensIn, tokensOut, costUsd, latencyMs };
}

// =============================================================================
// RN-robot T5: streaming + tool_use + prompt caching.
// Usato dal modulo m14-robot-assistant per il chat interattivo.
// =============================================================================

// Anthropic content block types (semplificati per il nostro uso).
export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type StreamMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type StreamToolsInput = {
  systemPrompt: string;
  messages: StreamMessage[];
  tools: Array<{ name: string; description: string; input_schema: object }>;
  model?: string;
  maxTokens?: number;
};

export type StreamToolsEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "done";
      stopReason: string;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
    };

/**
 * Streaming generator: emette text_delta in corso, tool_use al termine del
 * turno (solo blocchi completi), done con usage finale. Prompt caching sul
 * system prompt (ephemeral) per ridurre costi dei turn ripetuti con system
 * stabile.
 */
export async function* streamWithTools(
  input: StreamToolsInput,
): AsyncGenerator<StreamToolsEvent> {
  const client = getClient();
  const model = input.model ?? "claude-sonnet-4-6";

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: input.maxTokens ?? 1024,
      // Array-of-blocks con cache_control ephemeral: il system prompt viene
      // cacheato (TTL ~5min) e i turn successivi pagano ~0.1x sugli input token
      // che combaciano col prefix cacheato.
      system: [
        {
          type: "text",
          text: input.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      messages: input.messages,
      tools:
        input.tools.length > 0
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (input.tools as any)
          : undefined,
    });

    // Fase 1: text_delta in streaming
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text_delta", text: event.delta.text };
      }
    }

    // Fase 2: alla fine del turn, emetto i tool_use completi e il done con usage
    const final = await stream.finalMessage();
    for (const block of final.content) {
      if (block.type === "tool_use") {
        yield {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
    }

    const tokensIn = final.usage.input_tokens;
    const tokensOut = final.usage.output_tokens;
    const costUsd =
      (tokensIn * PRICE_INPUT_PER_M_USD + tokensOut * PRICE_OUTPUT_PER_M_USD) /
      1_000_000;

    yield {
      type: "done",
      stopReason: final.stop_reason ?? "end_turn",
      tokensIn,
      tokensOut,
      costUsd,
    };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    if (e?.status === 429) {
      const retryHeader = e?.headers?.["retry-after"];
      const retry = retryHeader ? Number(retryHeader) : null;
      throw new AiRateLimitError(Number.isFinite(retry) ? retry : null);
    }
    if (e?.name === "AbortError") {
      throw new AiTimeoutError("Anthropic stream aborted");
    }
    throw new AiApiError(e?.status ?? 500, e?.message ?? "Anthropic streaming error");
  }
}
