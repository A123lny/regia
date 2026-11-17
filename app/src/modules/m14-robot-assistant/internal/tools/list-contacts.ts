// RN-robot T6: tool listContacts — delega a m01-data-hub.listContacts con
// filtri brand-scoped e cap sui risultati per non esplodere il context window.

import { z } from "zod";
import { listContacts, type ListContactsInput } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  brandId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
  consentChannel: z.enum(["email", "sms", "whatsapp"]).optional(),
  consentStatus: z.enum(["granted", "revoked", "never"]).optional(),
  includeArchived: z.boolean().optional().default(false),
});

export const listContactsTool: RobotTool = {
  name: "listContacts",
  description:
    "Lista i contatti dell'organizzazione. Se brandId e' specificato filtra per quel brand; se omesso ritorna i contatti cross-brand (tutti i marchi). Per restringere a un brand specifico, chiama prima listBrands per ottenere l'id. Max 50 risultati.",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description:
          "UUID del brand per filtrare (opzionale). Se omesso, ritorna contatti cross-brand. Usa listBrands per trovare l'id da un nome.",
      },
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

    // brandId: priorita' a input (il modello puo' passarlo dopo listBrands);
    // fallback al pageContext (brand selezionato in UI); altrimenti cross-brand.
    const brandId = input.brandId ?? ctx.pageContext.brandId ?? undefined;

    const query: ListContactsInput = {
      organizationId: ctx.session.organizationId,
      limit: input.limit,
      includeArchived: input.includeArchived,
    };
    if (brandId) query.brandId = brandId;
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
