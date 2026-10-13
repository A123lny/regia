"use server";

// RF-12.1 Operational tasks — server actions.
// Entrambe le capability (read + crud) sono [owner, editor]: operativo.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  createTask,
  completeTask,
  reopenTask,
  cancelTask,
  updateTask,
  listOrgUsers,
  type OperationalTask,
  type OperationalTaskPriority,
} from "./tasks-repo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateTaskActionInput = {
  title: string;
  description?: string;
  priority: OperationalTaskPriority;
  assignedTo?: string;
  dueAt?: string;
};

export type TaskActionResult<T> = { ok: true; task: T } | { ok: false; error: string };

export async function createTaskAction(
  input: CreateTaskActionInput,
): Promise<TaskActionResult<OperationalTask>> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "tasks.crud");
    if (!input.title || input.title.trim().length === 0) {
      return { ok: false, error: "Titolo obbligatorio" };
    }
    if (input.title.length > 200) {
      return { ok: false, error: "Titolo troppo lungo (max 200)" };
    }
    // Verifica che assignedTo (se presente) sia un UUID + utente dell'org
    if (input.assignedTo) {
      if (!UUID_RE.test(input.assignedTo)) {
        return { ok: false, error: "Assegnatario non valido" };
      }
      const users = await listOrgUsers(session.organizationId);
      if (!users.some((u) => u.userId === input.assignedTo)) {
        return { ok: false, error: "Assegnatario non appartiene all'organizzazione" };
      }
    }
    const task = await createTask({
      organizationId: session.organizationId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      createdBy: session.userId,
      assignedTo: input.assignedTo ?? null,
      dueAt: input.dueAt ?? null,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "tasks.created",
      target: `task:${task.id}`,
      details: {
        priority: task.priority,
        assignedTo: task.assignedTo,
        hasDueDate: task.dueAt !== null,
      },
    });
    revalidatePath("/dashboard");
    return { ok: true, task };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function completeTaskAction(
  taskId: string,
): Promise<TaskActionResult<OperationalTask>> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "tasks.crud");
    if (!UUID_RE.test(taskId)) return { ok: false, error: "Task non valido" };
    const task = await completeTask(taskId, session.organizationId, session.userId);
    if (!task) return { ok: false, error: "Task non trovato o gia' completato" };
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "tasks.completed",
      target: `task:${taskId}`,
      details: {},
    });
    revalidatePath("/dashboard");
    return { ok: true, task };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function reopenTaskAction(taskId: string): Promise<TaskActionResult<OperationalTask>> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "tasks.crud");
    if (!UUID_RE.test(taskId)) return { ok: false, error: "Task non valido" };
    const task = await reopenTask(taskId, session.organizationId);
    if (!task) return { ok: false, error: "Task non trovato" };
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "tasks.reopened",
      target: `task:${taskId}`,
      details: {},
    });
    revalidatePath("/dashboard");
    return { ok: true, task };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function cancelTaskAction(
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "tasks.crud");
    if (!UUID_RE.test(taskId)) return { ok: false, error: "Task non valido" };
    await cancelTask(taskId, session.organizationId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "tasks.cancelled",
      target: `task:${taskId}`,
      details: {},
    });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type UpdateTaskActionInput = {
  taskId: string;
  title?: string;
  description?: string;
  priority?: OperationalTaskPriority;
  assignedTo?: string | null;
  dueAt?: string | null;
};

export async function updateTaskAction(
  input: UpdateTaskActionInput,
): Promise<TaskActionResult<OperationalTask>> {
  try {
    const session = await getSessionOrRedirect();
    requireCapability(session, "tasks.crud");
    if (!UUID_RE.test(input.taskId)) return { ok: false, error: "Task non valido" };
    // RNF-1 security: verifica assignedTo UUID + appartenenza all'org (coerente
    // con createTaskAction, previene cross-tenant assignment IDOR).
    if (input.assignedTo) {
      if (!UUID_RE.test(input.assignedTo)) {
        return { ok: false, error: "Assegnatario non valido" };
      }
      const users = await listOrgUsers(session.organizationId);
      if (!users.some((u) => u.userId === input.assignedTo)) {
        return { ok: false, error: "Assegnatario non appartiene all'organizzazione" };
      }
    }
    const patch: Parameters<typeof updateTask>[0] = {
      taskId: input.taskId,
      organizationId: session.organizationId,
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.assignedTo !== undefined) patch.assignedTo = input.assignedTo;
    if (input.dueAt !== undefined) patch.dueAt = input.dueAt;

    const task = await updateTask(patch);
    if (!task) return { ok: false, error: "Task non trovato" };
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "tasks.updated",
      target: `task:${task.id}`,
      details: {
        fields: Object.keys(input).filter((k) => k !== "taskId"),
      },
    });
    revalidatePath("/dashboard");
    return { ok: true, task };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
