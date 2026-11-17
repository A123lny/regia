// RN-robot T8: tool deleteContact — kind 'destructive', richiede conferma
// esplicita utente prima dell'esecuzione (vedi pending-actions-store).
//
// Nota: usa archiveContactAction (soft delete) non DELETE DB, coerente con
// il resto della Regia dove i contatti si archiviano (RF-1.9 GDPR).

import { z } from "zod";
import { archiveContactAction } from "@/modules/m01-data-hub/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  contactId: z.string().uuid(),
});

export const deleteContactTool: RobotTool = {
  name: "deleteContact",
  description:
    "Archivia (soft-delete) un contatto esistente. Il contatto non viene cancellato fisicamente ma marcato come archiviato (GDPR-safe, recuperabile). Richiede conferma esplicita utente prima dell'esecuzione (confirm flow).",
  input_schema: {
    type: "object",
    properties: {
      contactId: {
        type: "string",
        description: "UUID del contatto da archiviare",
      },
    },
    required: ["contactId"],
    additionalProperties: false,
  },
  requiredCapability: "contacts.crud",
  kind: "destructive",
  execute: async (rawInput) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    // archiveContactAction non ritorna un ok/error wrapper: throws se fallisce
    try {
      await archiveContactAction(parsed.data.contactId);
      return {
        ok: true,
        contactId: parsed.data.contactId,
        message: `Contatto ${parsed.data.contactId} archiviato.`,
      };
    } catch (err) {
      return {
        error: "archiviazione_fallita",
        message: err instanceof Error ? err.message : "errore sconosciuto",
      };
    }
  },
};
