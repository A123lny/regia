// RS-2: unico punto di accesso a Voyage AI. Nessun altro file può fare fetch
// diretto a api.voyageai.com. Il modulo m03-editorial passa da qui per
// calcolare embeddings su rejection_reason (RF-3.8 retrieval semantico).
//
// Voyage non offre SDK TypeScript maturo: usiamo fetch nativo. L'endpoint è
// documentato su https://docs.voyageai.com/reference/embeddings-api

export type EmbedTextInput = {
  text: string;
  model?: string;
};

export type EmbedTextResult = {
  embedding: number[]; // len 512 con voyage-3-lite
  tokensIn: number;
};

export class VoyageConfigError extends Error {
  readonly kind = "invalid_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "VoyageConfigError";
  }
}
export class VoyageApiError extends Error {
  readonly kind = "api_error" as const;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "VoyageApiError";
  }
}
export class VoyageTimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "VoyageTimeoutError";
  }
}

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const TIMEOUT_MS = 15_000;
const EXPECTED_DIM = 512;

export async function embedText(input: EmbedTextInput): Promise<EmbedTextResult> {
  const apiKey = process.env["VOYAGE_API_KEY"];
  if (!apiKey) {
    throw new VoyageConfigError("VOYAGE_API_KEY non impostata (server-only).");
  }
  const model = input.model ?? "voyage-3-lite";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [input.text],
        model,
        input_type: "document",
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new VoyageTimeoutError(`Voyage timeout ${TIMEOUT_MS}ms`);
    }
    throw new VoyageApiError(0, (err as Error).message);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new VoyageApiError(res.status, await res.text());
  }

  const json = (await res.json()) as {
    data: { embedding: number[] }[];
    usage: { total_tokens: number };
  };
  const embedding = json.data[0]?.embedding;
  if (!embedding || embedding.length !== EXPECTED_DIM) {
    throw new VoyageApiError(
      500,
      `Voyage embedding malformato (len=${embedding?.length ?? 0}, atteso ${EXPECTED_DIM})`,
    );
  }
  return { embedding, tokensIn: json.usage.total_tokens };
}
