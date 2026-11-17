// RN-robot T7: tool createContact — delega a m01-data-hub.createContactAction.

import { z } from "zod";
import { createContactAction } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  brandId: z.string().uuid().optional(),
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
    "Crea un nuovo contatto. Richiede brandId (se non è selezionato uno in sessione, chiama prima listBrands per trovare l'id). Richiede ALMENO uno di: email, phone, whatsapp. firstName e lastName opzionali ma consigliati. Source impostata a 'manuale'. Confirm flow: non viene eseguito subito, l'utente conferma nella UI.",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description:
          "UUID del brand in cui creare il contatto (opzionale se già selezionato in UI). Usa listBrands per trovarlo dal nome.",
      },
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

    const input = parsed.data;
    const brandId = input.brandId ?? ctx.pageContext.brandId ?? null;
    if (!brandId) {
      return {
        error: "brand_mancante",
        message:
          "Specifica brandId nell'input, oppure chiama listBrands per trovare l'id del brand e passalo esplicitamente.",
      };
    }

    if (!input.email && !input.phone && !input.whatsapp) {
      return {
        error: "recapito_mancante",
        message: "Serve almeno uno tra email, phone o whatsapp.",
      };
    }

    const result = await createContactAction({
      brandId,
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.whatsapp !== undefined && { whatsapp: input.whatsapp }),
      ...(input.notes !== undefined && { notes: input.notes }),
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
