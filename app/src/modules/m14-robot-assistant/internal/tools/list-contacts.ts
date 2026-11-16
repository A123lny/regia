// RN-robot T6: tool listContacts — delega a m01-data-hub.listContacts con
// filtri brand-scoped e cap sui risultati per non esplodere il context window.

import { z } from "zod";
import { listContacts, type ListContactsInput } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
  consentChannel: z.enum(["email", "sms", "whatsapp"]).optional(),
  consentStatus: z.enum(["granted", "revoked", "never"]).optional(),
  includeArchived: z.boolean().optional().default(false),
});

export const listContactsTool: RobotTool = {
  name: "listContacts",
  description:
    "Lista i contatti del brand attualmente selezionato. Filtri opzionali: consentChannel (email/sms/whatsapp), consentStatus (granted/revoked/pending), includeArchived. Max 50 risultati. Richiede un brand selezionato in sessione.",
  input_schema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Numero massimo di contatti da ritornare (default 20).",
      },
      consentChannel: {
        type: "string",
        enum: ["email", "sms", "whatsapp"],
        description: "Filtra per canale di consenso.",
      },
      consentStatus: {
        type: "string",
        enum: ["granted", "revoked", "never"],
        description: "Filtra per stato del consenso (usa con consentChannel).",
      },
      includeArchived: {
        type: "boolean",
        description: "Includi anche contatti archiviati (default false).",
      },
    },
    additionalProperties: false,
  },
  requiredCapability: "contacts.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const input = parsed.data;

    // Brand-scoped (design §15): il brand corrente arriva dal pageContext.
    if (!ctx.pageContext.brandId) {
      return {
        error: "brand_non_selezionato",
        message:
          "L'utente non ha selezionato un brand. Chiedigli su quale brand operare prima di ritentare.",
      };
    }

    const query: ListContactsInput = {
      organizationId: ctx.session.organizationId,
      brandId: ctx.pageContext.brandId,
      limit: input.limit,
      includeArchived: input.includeArchived,
    };
    if (input.consentChannel) query.consentChannel = input.consentChannel;
    if (input.consentStatus) query.consentStatus = input.consentStatus;

    const result = await listContacts(query);

    // Ritorno sintetico per il modello (no payload grezzo enorme).
    return {
      totalCount: result.totalCount,
      returned: result.items.length,
      items: result.items.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        source: c.source,
      })),
    };
  },
};
