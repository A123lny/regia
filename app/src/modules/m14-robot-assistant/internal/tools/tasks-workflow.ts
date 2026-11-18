// RN-robot: workflow task operativi M12 (lista + complete/reopen/cancel/update).
// Delega alle Server Action di m12 che applicano capability tasks.crud.

import { z } from "zod";
import {
  completeTaskAction,
  reopenTaskAction,
  cancelTaskAction,
  updateTaskAction,
} from "@/modules/m12-daily-use/public";
import { listTasks } from "@/modules/m12-daily-use/server";
import type { RobotTool } from "./tool-types";

// ============================================================
// Lista task
// ============================================================
const ListSchema = z.object({
  status: z.enum(["open", "done", "cancelled", "all"]).optional().default("open"),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const listTasksTool: RobotTool = {
  name: "listTasks",
  description:
    "Lista i task operativi (appuntamenti, promemoria). Filtro status: 'open' (default) / 'done' / 'cancelled' / 'all'. Usalo per 'quali task ho?', 'cosa devo fare?', 'task completati'.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["open", "done", "cancelled", "all"],
        description: "Filtro per stato (default 'open')",
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = ListSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const tasks = await listTasks({
      organizationId: ctx.session.organizationId,
      status: parsed.data.status,
      limit: parsed.data.limit,
    });
    return {
      total: tasks.length,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueAt: t.dueAt,
        description: t.description,
      })),
    };
  },
};

// ============================================================
// Complete task (segna fatto)
// ============================================================
const SimpleIdSchema = z.object({ taskId: z.string().uuid() });

export const completeTaskTool: RobotTool = {
  name: "completeTask",
  description:
    "Segna un task operativo come completato ('done'). Usalo per 'segna fatto il task X', 'ho completato Y', 'fatto'.",
  input_schema: {
    type: "object",
    properties: { taskId: { type: "string", description: "UUID del task" } },
    required: ["taskId"],
    additionalProperties: false,
  },
  requiredCapability: "tasks.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = SimpleIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await completeTaskAction(parsed.data.taskId);
    if (!result.ok) return { error: "completamento_fallito", message: result.error };
    return { ok: true, taskId: parsed.data.taskId, message: "Task segnato come fatto." };
  },
};

// ============================================================
// Reopen task
// ============================================================
export const reopenTaskTool: RobotTool = {
  name: "reopenTask",
  description:
    "Riapre un task precedentemente completato o cancellato. Usalo per 'riapri il task X', 'non era fatto'.",
  input_schema: {
    type: "object",
    properties: { taskId: { type: "string", description: "UUID del task" } },
    required: ["taskId"],
    additionalProperties: false,
  },
  requiredCapability: "tasks.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = SimpleIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await reopenTaskAction(parsed.data.taskId);
    if (!result.ok) return { error: "riapertura_fallita", message: result.error };
    return { ok: true, taskId: parsed.data.taskId, message: "Task riaperto." };
  },
};

// ============================================================
// Cancel task
// ============================================================
export const cancelTaskTool: RobotTool = {
  name: "cancelTask",
  description:
    "Cancella (archivia) un task operativo. Il task passa a status 'cancelled' (non viene cancellato fisicamente). Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: { taskId: { type: "string", description: "UUID del task" } },
    required: ["taskId"],
    additionalProperties: false,
  },
  requiredCapability: "tasks.crud",
  kind: "destructive",
  execute: async (rawInput) => {
    const parsed = SimpleIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await cancelTaskAction(parsed.data.taskId);
    if (!result.ok) return { error: "cancellazione_fallita", message: result.error };
    return { ok: true, taskId: parsed.data.taskId, message: "Task cancellato." };
  },
};

// ============================================================
// Update task
// ============================================================
const UpdateSchema = z.object({
  taskId: z.string().uuid(),
  patch: z.object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(["urgent", "important", "opportunity"]).optional(),
    dueAt: z.string().max(40).optional().nullable(),
  }),
});

function normalizeDueAt(raw: string | null | undefined): string | null | undefined {
  if (raw === null) return null; // esplicitamente rimuovere
  if (raw === undefined) return undefined;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const d2 = new Date(`${raw}T09:00:00+01:00`);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return undefined;
}

export const updateTaskTool: RobotTool = {
  name: "updateTask",
  description:
    "Aggiorna un task operativo esistente. Patch con i campi da cambiare (ometti quelli invariati). Per rimuovere la scadenza passa dueAt=null. Esempi: 'rinvia il task X a domani' -> patch.dueAt, 'cambia priorità del task X a urgente' -> patch.priority.",
  input_schema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "UUID del task" },
      patch: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["urgent", "important", "opportunity"] },
          dueAt: { type: ["string", "null"], description: "ISO 8601 o YYYY-MM-DD, null per rimuovere" },
        },
        additionalProperties: false,
      },
    },
    required: ["taskId", "patch"],
    additionalProperties: false,
  },
  requiredCapability: "tasks.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = UpdateSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const p = parsed.data.patch;
    const normalizedDue = normalizeDueAt(p.dueAt);
    if (p.dueAt !== undefined && p.dueAt !== null && normalizedDue === undefined) {
      return { error: "data_invalida", message: `Non ho capito la data "${p.dueAt}".` };
    }
    const result = await updateTaskAction({
      taskId: parsed.data.taskId,
      ...(p.title !== undefined && { title: p.title }),
      ...(p.description !== undefined && { description: p.description }),
      ...(p.priority !== undefined && { priority: p.priority }),
      ...(normalizedDue !== undefined && { dueAt: normalizedDue }),
    });
    if (!result.ok) return { error: "aggiornamento_fallito", message: result.error };
    return { ok: true, taskId: parsed.data.taskId, message: "Task aggiornato." };
  },
};
