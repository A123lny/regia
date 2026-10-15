// RF-12.1 Operational tasks — repo CRUD + list.

import { getAdminClient } from "@/lib/db/admin";

export type OperationalTaskPriority = "urgent" | "important" | "opportunity";
export type OperationalTaskStatus = "open" | "done" | "cancelled";

export type OperationalTask = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  priority: OperationalTaskPriority;
  status: OperationalTaskStatus;
  createdBy: string;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskRow = OperationalTask & {
  createdByEmail: string | null;
  assignedToEmail: string | null;
  completedByEmail: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(row: any): OperationalTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority as OperationalTaskPriority,
    status: row.status as OperationalTaskStatus,
    createdBy: row.created_by,
    assignedTo: row.assigned_to ?? null,
    dueAt: row.due_at ?? null,
    completedAt: row.completed_at ?? null,
    completedBy: row.completed_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ListTasksInput = {
  organizationId: string;
  status?: OperationalTaskStatus | "all";
  assignedTo?: string;
  createdBy?: string;
  limit?: number;
};

/**
 * Lista i task dell'organizzazione con join su auth.users per gli email.
 * Per F1 risolve gli email via admin.auth.admin.listUsers (chiamato dal caller).
 */
export async function listTasks(input: ListTasksInput): Promise<OperationalTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin.from("operational_tasks").select("*").eq("organization_id", input.organizationId);
  if (input.status && input.status !== "all") q = q.eq("status", input.status);
  if (input.assignedTo) q = q.eq("assigned_to", input.assignedTo);
  if (input.createdBy) q = q.eq("created_by", input.createdBy);
  q = q
    .order("status", { ascending: true }) // open first
    .order("priority", { ascending: true }) // urgent → opportunity (alphabetical lucky)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);
  const { data, error } = await q;
  if (error) throw new Error(`listTasks: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToTask);
}

/**
 * Lista task con due_at nel range [startIso, endIso). Serve alla day-view
 * del calendario editoriale per mostrare i task operativi insieme ai post.
 * Esclude i cancellati; include done e open.
 */
export async function listTasksByDueRange(
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<OperationalTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("operational_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .gte("due_at", startIso)
    .lt("due_at", endIso)
    .order("due_at", { ascending: true });
  if (error) throw new Error(`listTasksByDueRange: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToTask);
}

/**
 * Lista i task "attivi" (status=open) che devono comparire nel giorno
 * visualizzato della day-view, secondo la logica "sliding forward":
 * - Se il giorno visualizzato e' oggi: tutti i task open con due_at (inclusi
 *   quelli overdue, cosi' l'utente non li dimentica)
 * - Se e' un giorno futuro: solo i task con due_at >= dayStart (scadono
 *   oggi o dopo)
 * - Se e' un giorno passato: nessuno (i task non "si sdoppiano" indietro)
 *
 * Il colore / urgenza e' calcolato dal client in base alla differenza di
 * giorni fra due_at e il giorno visualizzato.
 */
export async function listTasksActiveOnDay(
  organizationId: string,
  dayStartIso: string,
  todayStartIso: string,
): Promise<OperationalTask[]> {
  if (dayStartIso < todayStartIso) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("operational_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .not("due_at", "is", null);
  if (dayStartIso !== todayStartIso) {
    // Giorno futuro: filtro per scadenza >= giorno visualizzato
    q = q.gte("due_at", dayStartIso);
  }
  const { data, error } = await q.order("due_at", { ascending: true });
  if (error) throw new Error(`listTasksActiveOnDay: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToTask);
}

export type CreateTaskInput = {
  organizationId: string;
  title: string;
  description?: string | null;
  priority: OperationalTaskPriority;
  createdBy: string;
  assignedTo?: string | null;
  dueAt?: string | null;
};

export async function createTask(input: CreateTaskInput): Promise<OperationalTask> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    priority: input.priority,
    status: "open",
    created_by: input.createdBy,
    assigned_to: input.assignedTo ?? null,
    due_at: input.dueAt ?? null,
  };
  const { data, error } = await admin.from("operational_tasks").insert(row).select("*").single();
  if (error) throw new Error(`createTask: ${error.message}`);
  return rowToTask(data);
}

export async function completeTask(
  taskId: string,
  organizationId: string,
  userId: string,
): Promise<OperationalTask | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("operational_tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .eq("status", "open") // guardia: solo open → done
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`completeTask: ${error.message}`);
  return data ? rowToTask(data) : null;
}

export async function reopenTask(
  taskId: string,
  organizationId: string,
): Promise<OperationalTask | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("operational_tasks")
    .update({ status: "open", completed_at: null, completed_by: null })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .in("status", ["done", "cancelled"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`reopenTask: ${error.message}`);
  return data ? rowToTask(data) : null;
}

export async function cancelTask(taskId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("operational_tasks")
    .update({ status: "cancelled" })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .eq("status", "open");
  if (error) throw new Error(`cancelTask: ${error.message}`);
  return true;
}

export type UpdateTaskInput = {
  taskId: string;
  organizationId: string;
  title?: string;
  description?: string | null;
  priority?: OperationalTaskPriority;
  assignedTo?: string | null;
  dueAt?: string | null;
};

export async function updateTask(input: UpdateTaskInput): Promise<OperationalTask | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch["title"] = input.title.trim();
  if (input.description !== undefined) patch["description"] = input.description?.trim() || null;
  if (input.priority !== undefined) patch["priority"] = input.priority;
  if (input.assignedTo !== undefined) patch["assigned_to"] = input.assignedTo;
  if (input.dueAt !== undefined) patch["due_at"] = input.dueAt;
  const { data, error } = await admin
    .from("operational_tasks")
    .update(patch)
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`updateTask: ${error.message}`);
  return data ? rowToTask(data) : null;
}

/**
 * Lista utenti dell'organizzazione per il dropdown "Assegna a".
 * Join users_profile (nel nostro schema) + auth.users per email.
 */
export async function listOrgUsers(
  organizationId: string,
): Promise<Array<{ userId: string; email: string; role: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: profiles, error } = await admin
    .from("users_profile")
    .select("user_id, role")
    .eq("organization_id", organizationId);
  if (error) throw new Error(`listOrgUsers: ${error.message}`);
  const users: Array<{ userId: string; email: string; role: string }> = [];
  for (const p of (profiles ?? []) as { user_id: string; role: string }[]) {
    const { data } = await admin.auth.admin.getUserById(p.user_id);
    const email = (data?.user?.email as string | undefined) ?? "sconosciuto@regia.local";
    users.push({ userId: p.user_id, email, role: p.role });
  }
  return users.sort((a, b) => a.email.localeCompare(b.email));
}
