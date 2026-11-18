// RN-robot: tool generateContentDraft — delega al motore editoriale M03.
//
// Il robottino NON duplica la logica di generazione contenuti (design §3
// non-goal). Si limita a invocare generateSocialPost di m03 che applica:
// tono di voce del brand, few-shot, policy capitolato, budget AI dedicato,
// workflow di approvazione umana. Confirm flow richiesto: costa soldi.

import { z } from "zod";
import { generateSocialPost } from "@/modules/m03-editorial/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  brandId: z.string().uuid(),
  themeInput: z.string().min(2).max(2000),
});

export const generateContentDraftTool: RobotTool = {
  name: "generateContentDraft",
  description:
    "Genera una nuova bozza di contenuto (post social) per un brand. Usa il motore editoriale M03 che applica tono di voce del brand e policy capitolato. Richiede brandId (chiama prima listBrands se manca) e themeInput (il tema/argomento del post in linguaggio naturale, 2-2000 char). Costa budget AI; passa dal confirm flow per autorizzazione esplicita. La bozza creata va poi approvata/schedulata manualmente da /contenuti.",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description: "UUID del brand per cui generare. Usa listBrands per trovarlo.",
      },
      themeInput: {
        type: "string",
        description:
          "Tema del post in linguaggio naturale, es. 'offerta serale pizza margherita a 8€ fino al 25 novembre'.",
      },
    },
    required: ["brandId", "themeInput"],
    additionalProperties: false,
  },
  requiredCapability: "content.generate",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const formData = new FormData();
    formData.set("themeInput", parsed.data.themeInput);
    const result = await generateSocialPost(parsed.data.brandId, formData);
    if (!result.ok) {
      return { error: "generazione_fallita", message: result.error };
    }
    return {
      ok: true,
      draftId: result.draftId,
      message: `Bozza creata (id ${result.draftId}). Vai in /contenuti per vederla e approvarla.`,
    };
  },
};
