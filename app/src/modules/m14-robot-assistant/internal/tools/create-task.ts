// RN-robot: tool createTask — crea un task operativo (appuntamento/promemoria
// per l'operatore, M12). Confirm flow richiesto (kind='write').

import { z } from "zod";
import { createTaskAction } from "@/modules/m12-daily-use/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["urgent", "important", "opportunity"]).optional().default("important"),
  dueAt: z.string().datetime().optional(),
});

export const createTaskTool: RobotTool = {
  name: "createTask",
  description:
    "Crea un task operativo (appuntamento, promemoria operativo, cosa da fare) per l'utente stesso o per il team. Usalo quando l'utente chiede 'aggiungi appuntamento', 'ricordami di X', 'crea task', 'devo chiamare Y il Z'. Parametri: title (obbligatorio, breve), description (dettagli), priority ('urgent'/'important'/'opportunity', default 'important'), dueAt (ISO datetime, es. '2026-11-19T10:00:00Z'). Confirm richiesto.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Titolo breve (2-200 char)" },
      description: { type: "string", description: "Dettagli opzionali" },
      priority: {
        type: "string",
        enum: ["urgent", "important", "opportunity"],
        description: "Priorità (default 'important')",
      },
      dueAt: {
        type: "string",
        description: "Scadenza ISO 8601 (es. '2026-11-19T10:00:00Z')",
      },
    },
    required: ["title"],
    additionalProperties: false,
  },
  requiredCapability: "tasks.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const { title, description, priority, dueAt } = parsed.data;
    const result = await createTaskAction({
      title,
      priority,
      ...(description && { description }),
      ...(dueAt && { dueAt }),
    });
    if (!result.ok) {
      return { error: "creazione_fallita", message: result.error };
    }
    return {
      ok: true,
      taskId: result.task.id,
      message: `Task '${title}' creato${dueAt ? ` per ${new Date(dueAt).toLocaleString("it-IT")}` : ""}.`,
    };
  },
};
