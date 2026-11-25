// Lista "Da fare" a 3 livelli: Urgente (rosso) · Questa settimana (ambra) ·
// Quando hai tempo (grigio). Riusa i dati di buildDashboardTasks + task
// manuali. Ogni riga ha titolo, contesto, azione principale "Vedi/Apri".

import Link from "next/link";
import { AlertCircle, Clock, Circle, ArrowRight } from "lucide-react";
import type { DashboardTaskList } from "@/modules/m12-daily-use/public";
import { CustomTaskRow } from "./custom-task-row";

type CustomTask = {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority: "important" | "opportunity" | "urgent";
};

const LEVEL_META = {
  urgent: {
    label: "Urgente",
    tone: "border-danger/40 bg-danger/5 text-danger",
    Icon: AlertCircle,
  },
  important: {
    label: "Questa settimana",
    tone: "border-warning/40 bg-warning/5 text-warning",
    Icon: Clock,
  },
  opportunity: {
    label: "Quando hai tempo",
    tone: "border-border bg-surface-muted/50 text-text-muted",
    Icon: Circle,
  },
} as const;

function TaskRow({
  title,
  context,
  href,
  actionLabel,
}: {
  title: string;
  context?: string | null;
  href: string;
  actionLabel: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5 hover:border-primary/40">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{title}</div>
        {context && <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">{context}</div>}
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text hover:border-primary hover:text-primary"
      >
        {actionLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </li>
  );
}

export function TodayTaskList({
  tasks,
  customTasks,
}: {
  tasks: DashboardTaskList;
  customTasks: CustomTask[];
}) {
  // Merge: task auto-generati + task manuali (manuali tutti in "urgent" o
  // "important" a seconda della priorita').
  const groupedCustom = {
    urgent: customTasks.filter((t) => t.priority === "urgent"),
    important: customTasks.filter((t) => t.priority === "important"),
    opportunity: customTasks.filter((t: CustomTask) => t.priority === "opportunity"),
  };

  const levels: Array<keyof typeof LEVEL_META> = ["urgent", "important", "opportunity"];
  const anyItems =
    tasks.urgent.length + tasks.important.length + tasks.opportunity.length + customTasks.length >
    0;

  if (!anyItems) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
        Nessun task per oggi. Guarda il calendario per i prossimi contenuti.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {levels.map((level) => {
        const auto = tasks[level];
        const manual = groupedCustom[level];
        if (auto.length === 0 && manual.length === 0) return null;
        const meta = LEVEL_META[level];
        const Icon = meta.Icon;
        return (
          <section key={level} className="space-y-2">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${meta.tone}`}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </div>
            <ul className="space-y-1.5">
              {auto.map((t) => (
                <TaskRow
                  key={t.id}
                  title={t.label}
                  context={t.instructions ?? null}
                  href={t.href}
                  actionLabel="Apri"
                />
              ))}
              {manual.map((t) => (
                <CustomTaskRow
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  description={t.description ?? null}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
