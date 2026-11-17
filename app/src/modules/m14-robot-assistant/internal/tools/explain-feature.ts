// RN-robot T6/RAG: tool explainFeature — ricerca semantica sul manuale
// piattaforma usando pgvector + embeddings Gemini.
//
// Richiede: tabella manuale_chunks indicizzata via `npm run index:manuale`.

import { z } from "zod";
import { getAdminClient } from "@/lib/db/admin";
import { embedContent } from "@/lib/ai/gemini";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  query: z.string().min(2).max(500),
  limit: z.number().int().min(1).max(5).optional().default(3),
});

type MatchRow = {
  section: string;
  heading: string;
  content: string;
  similarity: number;
};

export const explainFeatureTool: RobotTool = {
  name: "explainFeature",
  description:
    "Cerca una spiegazione di come si fa qualcosa nel manuale della Regìa (ricerca semantica, non testuale). Usalo quando l'utente chiede 'come si fa X', 'dove trovo Y', 'come funziona Z'. Ritorna i top 3 chunk più pertinenti con similarità. Se la similarità è bassa (<0.4), avvisa l'utente che il manuale non copre bene l'argomento e rispondi con quello che sai dal system prompt.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "La domanda o l'argomento da cercare nel manuale.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description: "Numero di risultati (default 3).",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const { query, limit } = parsed.data;

    let embedding: number[];
    try {
      const vecs = await embedContent([query]);
      if (vecs.length === 0 || !vecs[0]) {
        return { error: "embedding_vuoto", query };
      }
      embedding = vecs[0];
    } catch (err) {
      return {
        error: "embedding_fallito",
        message: err instanceof Error ? err.message : "errore sconosciuto",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    const { data, error } = await admin.rpc("match_manuale_chunks", {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      return {
        error: "ricerca_fallita",
        message: error.message,
        hint: "Verifica che la tabella manuale_chunks esista e che sia stata indicizzata con `npm run index:manuale`.",
      };
    }

    const rows = (data ?? []) as MatchRow[];
    if (rows.length === 0) {
      return {
        query,
        results: [],
        note: "Nessun risultato nel manuale. Potrebbe non essere stato indicizzato. Rispondi con quello che sai dal system prompt.",
      };
    }

    return {
      query,
      results: rows.map((r) => ({
        section: r.section,
        heading: r.heading,
        similarity: Number(r.similarity.toFixed(3)),
        excerpt: r.content.slice(0, 1200),
      })),
    };
  },
};
