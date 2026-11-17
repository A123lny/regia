// RS-2: wrapper per Gemini (Google GenAI). Espone la stessa API di anthropic.ts
// (streamWithTools) per permettere swap drop-in nei consumer.
//
// Perche' Gemini accanto a Anthropic: il robottino M14 usa Gemini (free tier
// generoso). Il motore editoriale (M03) continua a usare Anthropic Claude.

import { GoogleGenAI, type FunctionDeclaration, type Content, type Part } from "@google/genai";
import {
  AiConfigError,
  AiApiError,
  AiRateLimitError,
  AiTimeoutError,
  type StreamToolsInput,
  type StreamToolsEvent,
  type StreamMessage,
  type AnthropicContentBlock,
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
      functionDeclarations: tools.map(
        (t): FunctionDeclaration => ({
          name: t.name,
          description: t.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parameters: t.input_schema as any,
        }),
      ),
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
export async function* streamWithTools(
  input: StreamToolsInput,
): AsyncGenerator<StreamToolsEvent> {
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
      (totalTokensIn * PRICE_INPUT_PER_M_USD + totalTokensOut * PRICE_OUTPUT_PER_M_USD) /
      1_000_000;

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
