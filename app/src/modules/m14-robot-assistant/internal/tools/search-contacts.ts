// RN-robot T6: tool searchContacts — wrap di listContacts con parametro query
// testuale (ricerca su nome/email/phone). Brand-scoped.

import { z } from "zod";
import { listContacts } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  query: z.string().min(1).max(200),
  brandId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const searchContactsTool: RobotTool = {
  name: "searchContacts",
  description:
    "Cerca contatti per testo libero (nome, email, telefono). Se brandId e' specificato filtra per quel brand, altrimenti cross-brand. Max 50 risultati.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Testo da cercare in nome/cognome/email/telefono (match parziale case-insensitive).",
      },
      brandId: {
        type: "string",
        description: "UUID del brand (opzionale). Usa listBrands per trovarlo.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Numero massimo di risultati (default 10).",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  requiredCapability: "contacts.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }

    const brandId = parsed.data.brandId ?? ctx.pageContext.brandId ?? undefined;

    const result = await listContacts({
      organizationId: ctx.session.organizationId,
      ...(brandId && { brandId }),
      query: parsed.data.query,
      limit: parsed.data.limit,
    });

    return {
      query: parsed.data.query,
      totalCount: result.totalCount,
      returned: result.items.length,
      items: result.items.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
      })),
    };
  },
};
