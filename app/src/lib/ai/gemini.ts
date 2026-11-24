// RS-2: wrapper per Gemini (Google GenAI). Espone la stessa API di anthropic.ts
// (streamWithTools) per permettere swap drop-in nei consumer.
//
// Perche' Gemini accanto a Anthropic: il robottino M14 usa Gemini (free tier
// generoso). Il motore editoriale (M03) continua a usare Anthropic Claude.

import { GoogleGenAI, type FunctionDeclaration, type Content, type Part } from "@google/genai";
import {
  AiConfigError,
  AiApiError,
  AiMaxTokensError,
  AiRateLimitError,
  AiTimeoutError,
  type StreamToolsInput,
  type StreamToolsEvent,
  type StreamMessage,
} from "./anthropic";

let cached: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new AiConfigError("GEMINI_API_KEY non impostata (server-only).");
  }
  // Function Calling richiede apiVersion v1beta (v1 default la rifiuta — err 400).
  cached = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  return cached;
}

// Pricing Gemini 2.5 Flash al 2026-11 (free tier generoso: 15 RPM, 1M TPM, 1500 RPD).
// Oltre il free tier: $0.075/M input, $0.30/M output (approssimazione).
const PRICE_INPUT_PER_M_USD = 0.075;
const PRICE_OUTPUT_PER_M_USD = 0.3;

const DEFAULT_MODEL = "gemini-2.5-flash";
const EMBEDDING_MODEL = "gemini-embedding-2"; // default 3072d, supporta flexible dimensions 128-3072
const EMBEDDING_DIM = 768; // il nostro schema manuale_chunks e' vector(768)

/**
 * Generazione di testo semplice (non-streaming, no tools).
 * Usato per generazione bozze contenuti dal robottino (variante Gemini
 * di generateSocialPost di m03, che usa Anthropic).
 */
/**
 * Classifica se un errore del SDK e' transiente (rate limit / overload / 5xx) e
 * merita retry con backoff. Gemini free tier ha ~10 RPM, quindi anche piccole
 * raffiche di generazioni superano il quota.
 */
function retryDelayMsForStatus(status: number | undefined): number | null {
  if (status === 429) return 20_000; // rate limit: lascia ~20s
  if (status === 503) return 10_000; // overload: 10s
  if (status === 500 || status === 502 || status === 504) return 5_000;
  return null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateText(input: {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  /** Se 'application/json', Gemini forza la risposta JSON parsabile. */
  responseMimeType?: "text/plain" | "application/json";
}): Promise<{
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
}> {
  const client = getClient();
  const model = input.model ?? DEFAULT_MODEL;
  const started = Date.now();

  const requestedMaxTokens = input.maxTokens ?? 4096;

  // Retry su 429/503/5xx transient: free tier Gemini ha ~10 RPM, bastano poche
  // generazioni ravvicinate per far scattare il rate limit. 2 retry + attesa
  // graduale sono quasi sempre sufficienti a lasciar rientrare la finestra.
  let attempt = 0;
  const maxAttempts = 3; // originale + 2 retry
  while (true) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: input.userMessage }] }],
        config: {
          systemInstruction: input.systemPrompt,
          maxOutputTokens: requestedMaxTokens,
          // thinkingConfig: zero thinking budget -> l'intero maxOutputTokens
          // va nella risposta visibile. Senza questo, Gemini 2.5 Flash spende
          // in reasoning anche quando chiediamo un post semplice.
          thinkingConfig: { thinkingBudget: 0 },
          ...(input.responseMimeType && { responseMimeType: input.responseMimeType }),
        },
      });
      const latencyMs = Date.now() - started;

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p) => ("text" in p && p.text ? p.text : ""))
        .filter(Boolean)
        .join("");
      const finishReason = response.candidates?.[0]?.finishReason;

      // Usage calcolato una sola volta, usato anche sui path di errore sotto
      // cosi' il caller puo' sempre loggare la spesa effettiva (il billing
      // Gemini e' avvenuto comunque, non possiamo "scartarlo").
      const usage = response.usageMetadata;
      const tokensIn = usage?.promptTokenCount ?? 0;
      const tokensOut = usage?.candidatesTokenCount ?? 0;
      const costUsd =
        (tokensIn * PRICE_INPUT_PER_M_USD + tokensOut * PRICE_OUTPUT_PER_M_USD) / 1_000_000;

      if (!text) {
        throw new AiApiError(
          500,
          `Gemini: risposta senza testo (finish=${finishReason ?? "?"}). Possibile taglio per maxOutputTokens o safety.`,
        );
      }
      if (finishReason === "MAX_TOKENS") {
        throw new AiMaxTokensError(
          model,
          tokensIn,
          tokensOut,
          costUsd,
          latencyMs,
          `Gemini: risposta troncata al limite di ${requestedMaxTokens} token.`,
        );
      }

      return { text, model, tokensIn, tokensOut, costUsd, latencyMs };
    } catch (err) {
      // Preserva gli errori tipizzati che gia' portano context/usage: niente retry.
      if (err instanceof AiMaxTokensError) throw err;
      if (err instanceof AiApiError) throw err;
      if (err instanceof AiTimeoutError) throw err;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      const status = typeof e?.status === "number" ? (e.status as number) : undefined;

      // 429 / 5xx transient: backoff + retry finche' abbiamo tentativi.
      const delay = retryDelayMsForStatus(status);
      if (delay !== null && attempt < maxAttempts - 1) {
        attempt++;
        console.warn(
          `[gemini] generateText status=${status} attempt=${attempt}/${maxAttempts - 1}, retry in ${delay}ms`,
        );
        await sleep(delay);
        continue;
      }

      if (status === 429) throw new AiRateLimitError(null);
      if (e?.name === "AbortError") throw new AiTimeoutError("Gemini generateText aborted");
      throw new AiApiError(status ?? 500, e?.message ?? "Gemini generateText error");
    }
  }
}

/**
 * Embed one or more testi con Gemini text-embedding-004 (768 dimensioni).
 * Usato per RAG (indicizzazione manuale) e similarity search.
 */
export async function embedContent(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getClient();
  const results: number[][] = [];
  // Seriale: il SDK @google/genai v3 restituisce 1 embedding per chiamata.
  // Free tier Gemini: ~15 RPM; 50 chiamate sequenziali durano ~1-2 minuti.
  for (const text of texts) {
    try {
      const response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIM },
      });
      const values = response.embeddings?.[0]?.values;
      if (!values) {
        throw new AiApiError(500, "embedding senza values");
      }
      results.push(values);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      if (e?.status === 429) throw new AiRateLimitError(null);
      throw new AiApiError(e?.status ?? 500, e?.message ?? "Gemini embed error");
    }
  }
  return results;
}

/**
 * Converte una StreamMessage (formato Anthropic-like) in un Content di Gemini.
 * Costruisce anche la mappa id → nome dei tool per i tool_result (Gemini
 * lega la risposta al nome del tool, non a un id).
 */
function toGeminiContents(messages: StreamMessage[]): Content[] {
  const toolNameById = new Map<string, string>();

  // Prima passata: raccogli name per id
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "tool_use") toolNameById.set(b.id, b.name);
      }
    }
  }

  const contents: Content[] = [];
  for (const m of messages) {
    const role = m.role === "user" ? "user" : "model";
    const parts: Part[] = [];

    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else {
      for (const b of m.content) {
        if (b.type === "text") {
          parts.push({ text: b.text });
        } else if (b.type === "tool_use") {
          parts.push({
            functionCall: {
              name: b.name,
              args: (b.input ?? {}) as Record<string, unknown>,
            },
          });
        } else if (b.type === "tool_result") {
          const name = toolNameById.get(b.tool_use_id) ?? "unknown";
          // Gemini: functionResponse con response come object
          let responseObj: Record<string, unknown>;
          try {
            responseObj = JSON.parse(b.content) as Record<string, unknown>;
          } catch {
            responseObj = { result: b.content };
          }
          if (b.is_error) responseObj = { error: responseObj };
          parts.push({
            functionResponse: {
              name,
              response: responseObj,
            },
          });
        }
      }
    }

    if (parts.length > 0) contents.push({ role, parts });
  }

  return contents;
}

function toGeminiTools(
  tools: StreamToolsInput["tools"],
): Array<{ functionDeclarations: FunctionDeclaration[] }> {
  if (tools.length === 0) return [];
  return [
    {
      functionDeclarations: tools.map((t): FunctionDeclaration => ({
        name: t.name,
        description: t.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: t.input_schema as any,
      })),
    },
  ];
}

/**
 * Streaming generator: emette text_delta in corso, tool_use al termine del
 * turno (quando ricevuti via functionCall), done con usage finale.
 *
 * Nota: Gemini accumula functionCall come oggetti completi (non delta), quindi
 * li emettiamo appena disponibili. Usiamo un id sintetico `${name}-${index}`
 * perche' Gemini non assegna id ai tool call.
 */
export async function* streamWithTools(input: StreamToolsInput): AsyncGenerator<StreamToolsEvent> {
  const client = getClient();
  const model = input.model ?? DEFAULT_MODEL;

  const contents = toGeminiContents(input.messages);
  const tools = toGeminiTools(input.tools);

  try {
    const stream = await client.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: input.systemPrompt,
        maxOutputTokens: input.maxTokens ?? 1024,
        ...(tools.length > 0 && { tools }),
      },
    });

    let toolCallIndex = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let lastFinishReason: string = "end_turn";

    for await (const chunk of stream) {
      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      const parts = candidate.content?.parts ?? [];
      for (const part of parts) {
        if ("text" in part && part.text) {
          yield { type: "text_delta", text: part.text };
        } else if ("functionCall" in part && part.functionCall) {
          const fc = part.functionCall;
          toolCallIndex += 1;
          yield {
            type: "tool_use",
            id: `${fc.name}-${toolCallIndex}`,
            name: fc.name ?? "unknown",
            input: fc.args ?? {},
          };
        }
      }

      if (candidate.finishReason) {
        lastFinishReason = String(candidate.finishReason).toLowerCase();
      }

      // Usage arriva tipicamente nell'ultimo chunk
      const usage = chunk.usageMetadata;
      if (usage) {
        totalTokensIn = usage.promptTokenCount ?? totalTokensIn;
        totalTokensOut = usage.candidatesTokenCount ?? totalTokensOut;
      }
    }

    const costUsd =
      (totalTokensIn * PRICE_INPUT_PER_M_USD + totalTokensOut * PRICE_OUTPUT_PER_M_USD) / 1_000_000;

    yield {
      type: "done",
      stopReason: lastFinishReason,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      costUsd,
    };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    const status = e?.status ?? e?.response?.status;
    if (status === 429) {
      throw new AiRateLimitError(null);
    }
    if (e?.name === "AbortError") {
      throw new AiTimeoutError("Gemini stream aborted");
    }
    throw new AiApiError(status ?? 500, e?.message ?? "Gemini streaming error");
  }
}
