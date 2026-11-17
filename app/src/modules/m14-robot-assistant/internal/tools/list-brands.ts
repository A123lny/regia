// RN-robot: tool listBrands — lista dei marchi dell'organizzazione.

import { z } from "zod";
import { listBrands } from "@/modules/m02-brand/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  filter: z.enum(["active", "archived", "all"]).optional().default("active"),
});

export const listBrandsTool: RobotTool = {
  name: "listBrands",
  description:
    "Lista i marchi (brand) dell'organizzazione dell'utente. Utile quando l'utente chiede 'quanti marchi ho?', 'quali sono i miei brand?', 'mostrami anche i marchi archiviati'. Filtro: active (default) / archived / all.",
  input_schema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        enum: ["active", "archived", "all"],
        description: "Filtro di visibilità (default active)",
      },
    },
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const brands = await listBrands(ctx.session.organizationId, parsed.data.filter);
    return {
      total: brands.length,
      currentBrandId: ctx.pageContext.brandId,
      brands: brands.map((b) => ({
        id: b.id,
        slug: b.slug,
        displayName: b.displayName,
        isArchived: b.isArchived,
      })),
    };
  },
};
