// RN-robot: tool createTask — crea un task operativo (appuntamento/promemoria
// per l'operatore, M12). Confirm flow richiesto (kind='write').

import { z } from "zod";
import { createTaskAction } from "@/modules/m12-daily-use/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["urgent", "important", "opportunity"]).optional().default("important"),
  // Accettiamo sia ISO completo sia date-only (YYYY-MM-DD). Parsing applicativo.
  dueAt: z.string().max(40).optional(),
});

function normalizeDueAt(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  // Se gia' ISO con T, lascia stare (ma controlla che Date lo parsi).
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Fallback YYYY-MM-DD -> appende ore default 09:00 locale italiano
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const d2 = new Date(`${trimmed}T09:00:00+01:00`);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return undefined;
}

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
    const { title, description, priority, dueAt: dueAtRaw } = parsed.data;
    const dueAt = normalizeDueAt(dueAtRaw);
    if (dueAtRaw && !dueAt) {
      return {
        error: "data_invalida",
        message: `Non ho capito la data "${dueAtRaw}". Usa YYYY-MM-DD oppure ISO 8601 completo.`,
      };
    }
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
