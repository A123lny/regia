// RN-robot: tool listReminders — reminder operativi per il brand selezionato.

import { z } from "zod";
import { listReminders } from "@/modules/m09-reminders/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  brandId: z.string().uuid().optional(),
  status: z.enum(["pending", "sent", "dismissed", "expired"]).optional(),
  scheduledBeforeIso: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const listRemindersTool: RobotTool = {
  name: "listReminders",
  description:
    "Lista i reminder (promemoria operativi). Se brandId specificato filtra per quel brand, altrimenti cross-brand. Filtri opzionali: status (pending/sent/dismissed/expired) e scheduledBeforeIso. Usalo quando l'utente chiede 'cosa ho da fare?', 'reminder in scadenza', 'promemoria di oggi'.",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description: "UUID del brand (opzionale). Usa listBrands per trovarlo.",
      },
      status: {
        type: "string",
        enum: ["pending", "sent", "dismissed", "expired"],
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
  requiredCapability: "reminders.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }

    const input = parsed.data;
    const brandId = input.brandId ?? ctx.pageContext.brandId ?? undefined;

    const rows = await listReminders({
      organizationId: ctx.session.organizationId,
      ...(brandId && { brandId }),
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
