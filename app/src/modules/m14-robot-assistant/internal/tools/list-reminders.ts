// RN-robot: tool listReminders — reminder operativi per il brand selezionato.

import { z } from "zod";
import { listReminders } from "@/modules/m09-reminders/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  status: z.enum(["pending", "sent", "dismissed", "expired"]).optional(),
  scheduledBeforeIso: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const listRemindersTool: RobotTool = {
  name: "listReminders",
  description:
    "Lista i reminder (promemoria operativi) del brand attualmente selezionato. Filtri opzionali: status (pending/done/dismissed/cancelled) e scheduledBeforeIso (ISO datetime, es. '2026-11-20T23:59:59Z' per vedere cosa scade entro quel giorno). Usalo quando l'utente chiede 'cosa ho da fare?', 'reminder in scadenza', 'promemoria di oggi'. Brand-scoped.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "done", "dismissed", "cancelled"],
        description: "Filtra per stato",
      },
      scheduledBeforeIso: {
        type: "string",
        description: "ISO datetime: solo reminder con data entro questo istante",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
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

    if (!ctx.pageContext.brandId) {
      return {
        error: "brand_non_selezionato",
        message: "Seleziona prima un brand per vedere i reminder.",
      };
    }

    const input = parsed.data;
    const rows = await listReminders({
      organizationId: ctx.session.organizationId,
      brandId: ctx.pageContext.brandId,
      ...(input.status && { status: input.status }),
      ...(input.scheduledBeforeIso && { scheduledBeforeIso: input.scheduledBeforeIso }),
      limit: input.limit,
    });

    return {
      total: rows.length,
      reminders: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        scheduledAt: r.scheduledAt,
        contactName: r.contactFullName,
        messageHint: r.messageHint,
      })),
    };
  },
};
