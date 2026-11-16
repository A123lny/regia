// RN-robot T6: tool explainFeature — stub. Il RAG su manuale (pgvector +
// Voyage embeddings) e' rinviato a una sessione successiva (serve Docker).
// Per ora ritorna un messaggio chiaro al modello che la knowledge base e'
// in costruzione — il modello risponde con quello che sa dal system prompt.

import type { RobotTool } from "./tool-types";

export const explainFeatureTool: RobotTool = {
  name: "explainFeature",
  description:
    "Cerca una spiegazione di come si fa qualcosa nel manuale della Regia. Usalo quando l'utente chiede 'come si fa X', 'dove trovo Y', 'come funziona Z'. NOTE: la knowledge base dettagliata e' in costruzione; se il risultato e' vuoto, rispondi con quello che sai dal system prompt.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "La domanda o l'argomento da cercare nel manuale.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (input) => {
    const q = (input as { query?: string })?.query ?? "";
    return {
      query: q,
      results: [],
      note: "La ricerca semantica nel manuale della Regia e' in costruzione (RAG pgvector + Voyage embeddings in roadmap). Per ora rispondi usando quello che sai dal system prompt e dal contesto pagina.",
    };
  },
};
