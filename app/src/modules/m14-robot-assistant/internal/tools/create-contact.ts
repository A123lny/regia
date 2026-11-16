// RN-robot T7: tool createContact — delega a m01-data-hub.createContactAction.

import { z } from "zod";
import { createContactAction } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./registry";

const InputSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(30).optional(),
  whatsapp: z.string().min(5).max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export const createContactTool: RobotTool = {
  name: "createContact",
  description:
    "Crea un nuovo contatto nel brand attualmente selezionato. Richiede ALMENO uno di: email, phone, whatsapp. firstName e lastName sono opzionali ma consigliati. notes e' testo libero fino a 2000 char. Source viene settata a 'manuale'.",
  input_schema: {
    type: "object",
    properties: {
      firstName: { type: "string", description: "Nome" },
      lastName: { type: "string", description: "Cognome" },
      email: { type: "string", description: "Email" },
      phone: { type: "string", description: "Telefono (E.164 consigliato)" },
      whatsapp: { type: "string", description: "Numero WhatsApp" },
      notes: { type: "string", description: "Note libere" },
    },
    additionalProperties: false,
  },
  requiredCapability: "contacts.crud",
  kind: "write",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }

    if (!ctx.pageContext.brandId) {
      return {
        error: "brand_non_selezionato",
        message:
          "Chiedi all'utente su quale brand creare il contatto. Senza un brand selezionato il tool non puo' operare.",
      };
    }

    const input = parsed.data;
    if (!input.email && !input.phone && !input.whatsapp) {
      return {
        error: "recapito_mancante",
        message: "Serve almeno uno tra email, phone o whatsapp.",
      };
    }

    const result = await createContactAction({
      brandId: ctx.pageContext.brandId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp,
      notes: input.notes,
      source: "manuale",
    });

    if (!result.ok) {
      return { error: "creazione_fallita", message: result.error };
    }

    return {
      ok: true,
      contactId: result.contactId,
      message: `Contatto creato con id ${result.contactId}.`,
    };
  },
};
