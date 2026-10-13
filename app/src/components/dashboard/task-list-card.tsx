"use client";

// RF-12.1 Task list dashboard — vista unificata:
// A) Segnali di sistema (auto-generati dai moduli, read-only, link al modulo)
// B) Task manuali (CRUD, checkbox per completare, assegnabili al team)
// Entrambe raggruppate per priorita' (urgent/important/opportunity) con colori
// semaforo. Bottone "Nuovo task" + filtri "Tutti/Miei/Assegnati a me/Completati".

import { useState, useTransition } from "react";
import * as LucideIcons from "lucide-react";
import {
  ListChecks,
  Plus,
  Check as CheckIcon,
  Circle,
  User,
  Calendar,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type {
  DashboardTaskList,
  TaskListItem,
  OperationalTask,
  OperationalTaskPriority,
} from "@/modules/m12-daily-use/public";
import {
  createTaskAction,
  completeTaskAction,
  reopenTaskAction,
  cancelTaskAction,
} from "@/modules/m12-daily-use/public";

type Priority = "urgent" | "important" | "opportunity";
type OrgUser = { userId: string; email: string; role: string };
type Filter = "all" | "mine" | "assigned_to_me" | "done";

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: "bg-danger",
  important: "bg-warning",
  opportunity: "bg-success",
};
const PRIORITY_RING: Record<Priority, string> = {
  urgent: "ring-danger/30",
  important: "ring-warning/30",
  opportunity: "ring-success/30",
};
const PRIORITY_BG: Record<Priority, string> = {
  urgent: "bg-danger/5",
  important: "bg-warning/5",
  opportunity: "bg-success/5",
};
const PRIORITY_HINT: Record<Priority, string> = {
  urgent: "da fare oggi",
  important: "da fare questa settimana",
  opportunity: "quando c'e tempo",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  important: "Importante",
  opportunity: "Opportunita",
};

function SignalRow({ task }: { task: TaskListItem }) {
  const IconComp =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      task.iconName
    ] ?? LucideIcons.Circle;
  return (
    <a
      href={task.href}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-muted"
    >
      <span
        className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
        aria-hidden
      />
      <IconComp className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      <span className="flex-1 text-text">{task.label}</span>
      <span className="shrink-0 text-xs text-text-muted">→</span>
    </a>
  );
}

function CustomTaskRow({
  task,
  users,
  currentUserId,
  onChange,
}: {
  task: OperationalTask;
  users: OrgUser[];
  currentUserId: string;
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const assignee = task.assignedTo ? users.find((u) => u.userId === task.assignedTo) : null;
  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";

  const toggle = () => {
    startTransition(async () => {
      if (isDone) await reopenTaskAction(task.id);
      else await completeTaskAction(task.id);
      onChange();
    });
  };

  const remove = () => {
    if (!window.confirm("Eliminare questo task?")) return;
    startTransition(async () => {
      await cancelTaskAction(task.id);
      onChange();
    });
  };

  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueDate !== null && !isDone && !isCancelled && dueDate.getTime() < Date.now();

  return (
    <div
      className={`group flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-muted ${
        isDone ? "opacity-60" : ""
      } ${isCancelled ? "opacity-40 line-through" : ""}`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending || isCancelled}
        aria-label={isDone ? "Riapri task" : "Completa task"}
        className="mt-0.5 shrink-0"
      >
        {isDone ? (
          <CheckIcon className="h-4 w-4 rounded-full bg-success p-0.5 text-white" />
        ) : (
          <Circle
            className={`h-4 w-4 ${
              task.priority === "urgent"
                ? "text-danger"
                : task.priority === "important"
                  ? "text-warning"
                  : "text-success"
            }`}
          />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-text ${isDone ? "line-through" : ""}`}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
          {assignee && (
            <span className="inline-flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {assignee.email.split("@")[0]}
            </span>
          )}
          {dueDate && (
            <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-danger" : ""}`}>
              <Calendar className="h-2.5 w-2.5" />
              {dueDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
              {isOverdue && " · in ritardo"}
            </span>
          )}
          {task.createdBy !== currentUserId && !assignee && (
            <span className="italic">creato da altri</span>
          )}
        </div>
      </div>
      {!isDone && !isCancelled && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label="Elimina task"
          className="shrink-0 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {isDone && (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label="Riapri task"
          className="shrink-0 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
          title="Riapri"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

type Props = {
  signals: DashboardTaskList;
  customTasks: OperationalTask[];
  users: OrgUser[];
  currentUserId: string;
};

export function TaskListCard({ signals, customTasks, users, currentUserId }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const totalSignals = signals.totalCount;
  const openTasks = customTasks.filter((t) => t.status === "open");
  const doneTasks = customTasks.filter((t) => t.status === "done");
  const totalCustomOpen = openTasks.length;

  const filteredCustom = customTasks.filter((t) => {
    if (filter === "all") return t.status !== "cancelled";
    if (filter === "mine") return t.createdBy === currentUserId && t.status !== "cancelled";
    if (filter === "assigned_to_me")
      return t.assignedTo === currentUserId && t.status !== "cancelled";
    if (filter === "done") return t.status === "done";
    return true;
  });

  const customByPriority = {
    urgent: filteredCustom.filter((t) => t.priority === "urgent" && t.status === "open"),
    important: filteredCustom.filter((t) => t.priority === "important" && t.status === "open"),
    opportunity: filteredCustom.filter((t) => t.priority === "opportunity" && t.status === "open"),
  };
  const customDone = filteredCustom.filter((t) => t.status === "done");

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <section key={refreshKey} className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Da fare
          </h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
            {totalSignals + totalCustomOpen}
          </span>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="bg-primary text-white hover:bg-primary-hover">
              <Plus className="mr-1 h-3 w-3" />
              Nuovo task
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-serif">Nuovo task</SheetTitle>
            </SheetHeader>
            <div className="mt-4 px-4 pb-8">
              <NewTaskForm
                users={users}
                currentUserId={currentUserId}
                onDone={() => {
                  setSheetOpen(false);
                  handleRefresh();
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Segnali di sistema */}
      {totalSignals > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Segnali di sistema ({totalSignals})
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {(["urgent", "important", "opportunity"] as Priority[]).map((p) => {
              const tasks = signals[p];
              if (tasks.length === 0) return null;
              return (
                <div
                  key={p}
                  className={`rounded-lg ring-1 ${PRIORITY_RING[p]} ${PRIORITY_BG[p]} p-2`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${PRIORITY_DOT[p]}`}
                      aria-hidden
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text">
                      {PRIORITY_LABEL[p]}
                    </span>
                    <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
                      {tasks.length}
                    </span>
                    <span className="ml-auto text-[9px] text-text-muted">{PRIORITY_HINT[p]}</span>
                  </div>
                  <div className="space-y-0.5">
                    {tasks.map((t) => (
                      <SignalRow key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task manuali */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Task manuali ({totalCustomOpen} aperti, {doneTasks.length} completati)
          </div>
          <div className="ml-auto flex gap-1 text-[10px]">
            {(
              [
                ["all", "Tutti"],
                ["mine", "Miei"],
                ["assigned_to_me", "Assegnati a me"],
                ["done", "Completati"],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded px-1.5 py-0.5 ${
                  filter === k
                    ? "bg-primary text-white"
                    : "bg-surface-muted text-text-muted hover:text-text"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {filter !== "done" ? (
          totalCustomOpen === 0 && doneTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-bg p-6 text-center text-xs italic text-text-muted">
              Nessun task manuale. Clicca &quot;Nuovo task&quot; in alto per crearne uno.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {(["urgent", "important", "opportunity"] as Priority[]).map((p) => {
                const tasks = customByPriority[p];
                if (tasks.length === 0) return null;
                return (
                  <div
                    key={p}
                    className={`rounded-lg ring-1 ${PRIORITY_RING[p]} ${PRIORITY_BG[p]} p-2`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${PRIORITY_DOT[p]}`}
                        aria-hidden
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text">
                        {PRIORITY_LABEL[p]}
                      </span>
                      <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
                        {tasks.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {tasks.map((t) => (
                        <CustomTaskRow
                          key={t.id}
                          task={t}
                          users={users}
                          currentUserId={currentUserId}
                          onChange={handleRefresh}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="rounded-lg border border-border bg-bg p-2">
            {customDone.length === 0 ? (
              <div className="p-4 text-center text-xs italic text-text-muted">
                Nessun task completato.
              </div>
            ) : (
              <div className="space-y-0.5">
                {customDone.map((t) => (
                  <CustomTaskRow
                    key={t.id}
                    task={t}
                    users={users}
                    currentUserId={currentUserId}
                    onChange={handleRefresh}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {totalSignals === 0 && totalCustomOpen === 0 && doneTasks.length === 0 && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/5 p-4 text-center text-sm text-text-muted">
          Niente di urgente oggi. Nessun task operativo pendente.
        </div>
      )}
    </section>
  );
}

function NewTaskForm({
  users,
  currentUserId,
  onDone,
}: {
  users: OrgUser[];
  currentUserId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<OperationalTaskPriority>("important");
  const [assignTo, setAssignTo] = useState<string>(currentUserId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof createTaskAction>[0] = {
            title: String(fd.get("title") ?? ""),
            priority,
          };
          const desc = String(fd.get("description") ?? "").trim();
          if (desc) payload.description = desc;
          if (assignTo) payload.assignedTo = assignTo;
          const dueAt = String(fd.get("due_at") ?? "").trim();
          if (dueAt) payload.dueAt = new Date(dueAt).toISOString();
          const r = await createTaskAction(payload);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="title">Titolo</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>
      <div>
        <Label htmlFor="description">Descrizione (opzionale)</Label>
        <Textarea id="description" name="description" rows={2} maxLength={2000} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="priority">Priorita</Label>
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as OperationalTaskPriority)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="urgent">Urgente</option>
            <option value="important">Importante</option>
            <option value="opportunity">Opportunita</option>
          </select>
        </div>
        <div>
          <Label htmlFor="due_at">Scadenza (opzionale)</Label>
          <Input id="due_at" name="due_at" type="date" />
        </div>
      </div>
      <div>
        <Label htmlFor="assigned_to">Assegna a</Label>
        <select
          id="assigned_to"
          value={assignTo}
          onChange={(e) => setAssignTo(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        >
          <option value="">Nessuno (chiunque puo prenderlo)</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.email} {u.userId === currentUserId ? "(me)" : ""} - {u.role}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Creo..." : "Crea task"}
        </Button>
      </div>
    </form>
  );
}
