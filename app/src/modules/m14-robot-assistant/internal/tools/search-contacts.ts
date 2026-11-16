// RN-robot T6: tool searchContacts — wrap di listContacts con parametro query
// testuale (ricerca su nome/email/phone). Brand-scoped.

import { z } from "zod";
import { listContacts } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./registry";

const InputSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const searchContactsTool: RobotTool = {
  name: "searchContacts",
  description:
    "Cerca contatti per testo libero (nome, email, telefono) nel brand selezionato. Max 50 risultati. Usalo quando l'utente chiede 'cerca Mario', 'contatti con dominio gmail', ecc.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Testo da cercare in nome/cognome/email/telefono (match parziale case-insensitive).",
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

    if (!ctx.pageContext.brandId) {
      return {
        error: "brand_non_selezionato",
        message: "Seleziona prima un brand per cercare contatti.",
      };
    }

    const result = await listContacts({
      organizationId: ctx.session.organizationId,
      brandId: ctx.pageContext.brandId,
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
