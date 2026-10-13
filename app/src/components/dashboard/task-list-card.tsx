// RF-12.1 Task list dashboard — vista unificata delle cose da fare oggi/sett.
// Server Component che riceve l'aggregato pre-fetchato dalla pagina.
// 3 priorita' con colore semaforo (rosso/giallo/verde), click apre il modulo
// responsabile. Se non ci sono task mostra empty state positivo.

import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { ListChecks } from "lucide-react";
import type { DashboardTaskList, TaskListItem } from "@/modules/m12-daily-use/public";

const PRIORITY_DOT: Record<"urgent" | "important" | "opportunity", string> = {
  urgent: "bg-danger",
  important: "bg-warning",
  opportunity: "bg-success",
};

const PRIORITY_RING: Record<"urgent" | "important" | "opportunity", string> = {
  urgent: "ring-danger/30",
  important: "ring-warning/30",
  opportunity: "ring-success/30",
};

const PRIORITY_BG: Record<"urgent" | "important" | "opportunity", string> = {
  urgent: "bg-danger/5",
  important: "bg-warning/5",
  opportunity: "bg-success/5",
};

const PRIORITY_HINT: Record<"urgent" | "important" | "opportunity", string> = {
  urgent: "da fare oggi",
  important: "da fare questa settimana",
  opportunity: "quando c'e tempo",
};

function TaskRow({ task }: { task: TaskListItem }) {
  const IconComp =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      task.iconName
    ] ?? LucideIcons.Circle;
  return (
    <Link
      href={task.href}
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-surface-muted"
    >
      <span
        className={`inline-flex h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
        aria-hidden
      />
      <IconComp className="h-4 w-4 shrink-0 text-text-muted" />
      <span className="flex-1 text-text">{task.label}</span>
      <span className="shrink-0 text-xs text-text-muted">→</span>
    </Link>
  );
}

function PriorityGroup({
  title,
  priority,
  tasks,
}: {
  title: string;
  priority: "urgent" | "important" | "opportunity";
  tasks: TaskListItem[];
}) {
  if (tasks.length === 0) return null;
  return (
    <div className={`rounded-lg ring-1 ${PRIORITY_RING[priority]} ${PRIORITY_BG[priority]} p-3`}>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`}
            aria-hidden
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-text">{title}</span>
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
            {tasks.length}
          </span>
        </div>
        <span className="text-[10px] text-text-muted">{PRIORITY_HINT[priority]}</span>
      </div>
      <div className="space-y-0.5">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

export function TaskListCard({ tasks }: { tasks: DashboardTaskList }) {
  if (tasks.totalCount === 0) {
    return (
      <section className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <div
              className="text-base font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Niente di urgente oggi
            </div>
            <div className="text-xs text-text-muted">
              Nessun task operativo pendente. Buon lavoro.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Da fare
          </h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
            {tasks.totalCount}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <PriorityGroup title="Urgente" priority="urgent" tasks={tasks.urgent} />
        <PriorityGroup title="Importante" priority="important" tasks={tasks.important} />
        <PriorityGroup title="Opportunita" priority="opportunity" tasks={tasks.opportunity} />
      </div>
    </section>
  );
}
