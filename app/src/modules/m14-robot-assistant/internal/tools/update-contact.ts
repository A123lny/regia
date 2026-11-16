// RN-robot T7: tool updateContact — delega a m01-data-hub.updateContactAction.

import { z } from "zod";
import { updateContactAction } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./registry";

const InputSchema = z.object({
  contactId: z.string().uuid(),
  patch: z.object({
    firstName: z.string().min(1).max(100).nullable().optional(),
    lastName: z.string().min(1).max(100).nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().min(5).max(30).nullable().optional(),
    whatsapp: z.string().min(5).max(30).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
});

export const updateContactTool: RobotTool = {
  name: "updateContact",
  description:
    "Aggiorna uno o piu' campi di un contatto esistente. Richiede contactId (uuid) e patch con i campi da cambiare. Passa null per svuotare un campo, undefined per lasciarlo com'e'.",
  input_schema: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "UUID del contatto" },
      patch: {
        type: "object",
        description: "Campi da aggiornare (ometti quelli che non cambi)",
        properties: {
          firstName: { type: ["string", "null"] },
          lastName: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          whatsapp: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        additionalProperties: false,
      },
    },
    required: ["contactId", "patch"],
    additionalProperties: false,
  },
  requiredCapability: "contacts.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }

    const result = await updateContactAction({
      contactId: parsed.data.contactId,
      patch: parsed.data.patch,
    });
    if (!result.ok) {
      return { error: "aggiornamento_fallito", message: result.error };
    }
    return {
      ok: true,
      message: `Contatto ${parsed.data.contactId} aggiornato.`,
    };
  },
};
