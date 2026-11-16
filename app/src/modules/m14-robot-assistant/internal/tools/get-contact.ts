// RN-robot T6: tool getContact — singolo contatto per id, tenant-scoped.

import { z } from "zod";
import { getContact } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./registry";

const InputSchema = z.object({
  contactId: z.string().uuid(),
});

export const getContactTool: RobotTool = {
  name: "getContact",
  description:
    "Legge un singolo contatto per id (uuid). Ritorna null se non trovato o appartiene ad altra organizzazione.",
  input_schema: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "UUID del contatto da leggere." },
    },
    required: ["contactId"],
    additionalProperties: false,
  },
  requiredCapability: "contacts.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }

    const contact = await getContact(parsed.data.contactId, ctx.session.organizationId);
    if (!contact) return { contact: null };

    // Brand-scoping (design §15): se il contatto esiste ma e' di un altro brand
    // (rispetto al brand selezionato), non lo ritorniamo per non leakare cross-brand.
    if (ctx.pageContext.brandId && contact.brandId !== ctx.pageContext.brandId) {
      return { contact: null };
    }

    return {
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        whatsapp: contact.whatsapp,
        tags: contact.tags,
        notes: contact.notes,
        source: contact.source,
        archivedAt: contact.archivedAt,
      },
    };
  },
};
