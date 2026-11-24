"use client";

// Day-view client: griglia oraria verticale 06:00-23:00 con drag&drop per cambiare l'ora,
// menu contestuale (Modifica / Riprogramma preciso / Togli dal calendario / Elimina),
// dialog nativi HTML per input orario + conferma delete.

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  MoreVertical,
  ExternalLink,
  Clock,
  CalendarX,
  Trash2,
  Plus,
  Check as CheckIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  rescheduleContentDraft,
  unscheduleContentDraft,
  deleteContentDraft,
} from "@/modules/m03-editorial/public";
import {
  createTaskAction,
  completeTaskAction,
  cancelTaskAction,
} from "@/modules/m12-daily-use/public";
import type { OperationalTask, OperationalTaskPriority } from "@/modules/m12-daily-use/public";

const FALLBACK_COLOR = "#7a6857";

type Post = {
  id: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  themeInput: string;
  generatedText: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
};

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i); // 06..23

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hourOf(iso: string | null): number {
  if (!iso) return -1;
  return new Date(iso).getHours();
}

function formatHm(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Cambia solo l'ora di un ISO mantenendo minuti/secondi/data.
function withHour(iso: string, newHour: number): string {
  const d = new Date(iso);
  d.setHours(newHour);
  return d.toISOString();
}

// Restituisce il valore di `datetime-local` (YYYY-MM-DDTHH:mm) per un ISO in local time.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

// Interpreta l'input `datetime-local` come local time e ritorna ISO UTC.
// NB: evitiamo `new Date("YYYY-MM-DDTHH:mm")` perche' alcuni browser lo
// interpretano come UTC (invece che local time), slittando il giorno in
// timezone come Europe/Rome. Parsiamo esplicitamente ed usiamo il
// constructor locale, che non ha ambiguita'.
function localInputToIso(local: string): string {
  const [datePart, timePart = "00:00"] = local.split("T");
  const [y, m, d] = (datePart ?? "").split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = timePart.split(":").map((n) => parseInt(n, 10));
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    hh === undefined ||
    mm === undefined ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d) ||
    Number.isNaN(hh) ||
    Number.isNaN(mm)
  ) {
    // Fallback: lasciamo che il browser provi
    return new Date(local).toISOString();
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

function PostCard({
  post,
  isPast,
  onReschedule,
  onDelete,
}: {
  post: Post;
  isPast: boolean;
  onReschedule: (post: Post) => void;
  onDelete: (post: Post) => void;
}) {
  const color = post.brandColor || FALLBACK_COLOR;
  const isPublished = post.status === "published";
  const canDrag = !isPast && !isPublished;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : isPending ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-start gap-2 rounded-md border border-border bg-surface p-2 shadow-sm ${
        canDrag ? "cursor-grab hover:border-primary/50 active:cursor-grabbing" : "cursor-default"
      } ${isPublished ? "opacity-80" : ""}`}
    >
      {/* Barra colorata brand sul lato sinistro */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-md"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {/* Handle drag (occupa gran parte della card) */}
      <div className="flex-1 pl-2" {...listeners} {...attributes}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            {post.brandDisplayName} · {formatHm(post.scheduledAt)}
          </span>
          {isPublished && (
            <span className="rounded-full bg-text-muted/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-text-muted">
              Pubblicato
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs font-medium text-text">{truncate(post.themeInput, 60)}</div>
        <div className="text-[11px] text-text-muted">{truncate(post.generatedText, 90)}</div>
      </div>

      {/* Menu contestuale */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded p-1 text-text-muted hover:bg-surface-muted"
            aria-label="Azioni sul post"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/contenuti/${post.brandSlug}/${post.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" /> Modifica testo
            </Link>
          </DropdownMenuItem>
          {!isPublished && !isPast && (
            <>
              <DropdownMenuItem onSelect={() => onReschedule(post)}>
                <Clock className="mr-2 h-4 w-4" /> Riprogramma…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  startTransition(async () => {
                    try {
                      await unscheduleContentDraft(post.id);
                      router.refresh();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Errore");
                    }
                  });
                }}
              >
                <CalendarX className="mr-2 h-4 w-4" /> Togli dal calendario
              </DropdownMenuItem>
            </>
          )}
          {!isPublished && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onDelete(post)}
                className="text-danger focus:text-danger"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Elimina definitivamente
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Calcola giorni fra due_at e il giorno visualizzato (entrambi normalizzati
// a mezzanotte locale). Positivo = la scadenza e' nel futuro rispetto al
// giorno visualizzato, 0 = scade in questo giorno, negativo = overdue.
function daysUntilDue(dayYmd: string, dueAtIso: string | null): number {
  if (!dueAtIso) return 999;
  const parts = dayYmd.split("-");
  const y1 = parseInt(parts[0] ?? "", 10);
  const m1 = parseInt(parts[1] ?? "", 10);
  const d1 = parseInt(parts[2] ?? "", 10);
  const due = new Date(dueAtIso);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / (24 * 3600 * 1000));
}

type UrgencyLevel = "overdue" | "today" | "tomorrow" | "soon" | "later";

function urgencyFromDays(days: number): UrgencyLevel {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 3) return "soon";
  return "later";
}

const URGENCY_STYLES: Record<UrgencyLevel, { bar: string; chip: string; chipLabel: string }> = {
  overdue: {
    bar: "bg-danger",
    chip: "bg-danger text-white",
    chipLabel: "In ritardo",
  },
  today: {
    bar: "bg-danger",
    chip: "bg-danger/90 text-white",
    chipLabel: "Scade oggi",
  },
  tomorrow: {
    bar: "bg-warning",
    chip: "bg-warning/20 text-warning border border-warning/40",
    chipLabel: "Scade domani",
  },
  soon: {
    bar: "bg-warning/60",
    chip: "bg-warning/10 text-warning border border-warning/30",
    chipLabel: "In arrivo",
  },
  later: {
    bar: "bg-success/70",
    chip: "bg-success/10 text-success border border-success/30",
    chipLabel: "Pianificato",
  },
};

function TaskPillCard({
  task,
  dayYmd,
  currentUserId,
  onRefresh,
}: {
  task: OperationalTask;
  dayYmd: string;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const days = daysUntilDue(dayYmd, task.dueAt);
  const urgency = urgencyFromDays(days);
  const style = URGENCY_STYLES[urgency];

  const complete = () => {
    startTransition(async () => {
      await completeTaskAction(task.id);
      onRefresh();
    });
  };

  const remove = () => {
    if (!window.confirm("Eliminare questo task?")) return;
    startTransition(async () => {
      await cancelTaskAction(task.id);
      onRefresh();
    });
  };

  const dueLabel = task.dueAt
    ? new Date(task.dueAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
    : "—";
  const whenLabel =
    days === 0
      ? `oggi · ${formatHm(task.dueAt)}`
      : days === 1
        ? `domani · ${formatHm(task.dueAt)}`
        : days > 1
          ? `fra ${days} giorni (${dueLabel})`
          : days === -1
            ? `ieri (${dueLabel})`
            : `${Math.abs(days)} giorni fa (${dueLabel})`;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} aria-hidden="true" />
      <div className="pl-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}
          >
            {style.chipLabel}
          </span>
          {task.createdBy !== currentUserId && (
            <span className="rounded-full bg-text-muted/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-muted">
              Altri
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-text">{truncate(task.title, 80)}</div>
        {task.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">{task.description}</p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-text-muted">
          <span>{whenLabel}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={complete}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
              aria-label="Completa task"
              title="Segna come fatto"
            >
              <CheckIcon className="h-3 w-3" /> Fatto
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Elimina task"
              title="Elimina"
              className="rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskBanner({
  tasks,
  dayYmd,
  currentUserId,
  onRefresh,
}: {
  tasks: OperationalTask[];
  dayYmd: string;
  currentUserId: string;
  onRefresh: () => void;
}) {
  if (tasks.length === 0) return null;
  const overdueCount = tasks.filter((t) => daysUntilDue(dayYmd, t.dueAt) < 0).length;
  const todayCount = tasks.filter((t) => daysUntilDue(dayYmd, t.dueAt) === 0).length;
  const sorted = [...tasks].sort(
    (a, b) => daysUntilDue(dayYmd, a.dueAt) - daysUntilDue(dayYmd, b.dueAt),
  );

  return (
    <section className="mb-4 rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text">
          Task attivi ({tasks.length})
        </h2>
        {overdueCount > 0 && (
          <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
            {overdueCount} in ritardo
          </span>
        )}
        {todayCount > 0 && (
          <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold text-danger">
            {todayCount} oggi
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((t) => (
          <TaskPillCard
            key={t.id}
            task={t}
            dayYmd={dayYmd}
            currentUserId={currentUserId}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </section>
  );
}

function HourSlot({
  hour,
  posts,
  isPast,
  onReschedule,
  onDelete,
  onNewTask,
}: {
  hour: number;
  posts: Post[];
  isPast: boolean;
  onReschedule: (post: Post) => void;
  onDelete: (post: Post) => void;
  onNewTask: (hour: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `hour-${hour}`,
    disabled: isPast,
  });

  const isEmpty = posts.length === 0;

  return (
    <div className="grid grid-cols-[60px_1fr] gap-2">
      <div className="pt-2 text-right text-xs font-medium text-text-muted">{pad2(hour)}:00</div>
      <div
        ref={setNodeRef}
        className={`min-h-[64px] rounded-md border p-1.5 transition-colors ${
          isPast
            ? "border-border/40 bg-surface-muted/30"
            : isOver
              ? "border-primary bg-primary/5"
              : "border-border/60 bg-surface hover:border-primary/40"
        }`}
      >
        {isEmpty ? (
          isPast ? (
            <div className="flex h-full min-h-[52px] items-center justify-center text-[10px] text-text-muted/40" />
          ) : (
            <button
              type="button"
              onClick={() => onNewTask(hour)}
              className="group/add flex h-full min-h-[52px] w-full items-center justify-center gap-1 rounded text-[10px] text-text-muted/50 transition-colors hover:bg-primary/5 hover:text-primary"
              aria-label={`Nuovo task alle ${pad2(hour)}:00`}
            >
              <Plus className="h-3 w-3 opacity-0 transition-opacity group-hover/add:opacity-100" />
              <span className="opacity-0 transition-opacity group-hover/add:opacity-100">
                Nuovo task
              </span>
              <span className="group-hover/add:hidden">{isOver ? "Rilascia qui" : "—"}</span>
            </button>
          )
        ) : (
          <div className="flex flex-col gap-1.5">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                isPast={isPast}
                onReschedule={onReschedule}
                onDelete={onDelete}
              />
            ))}
            {!isPast && (
              <button
                type="button"
                onClick={() => onNewTask(hour)}
                className="flex items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[10px] text-text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Aggiungi task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type OrgUser = { userId: string; email: string; role: string };

export function DayViewClient({
  posts,
  tasks,
  users,
  currentUserId,
  dayYmd,
  isPast,
}: {
  posts: Post[];
  tasks: OperationalTask[];
  users: OrgUser[];
  currentUserId: string;
  dayYmd: string;
  isPast: boolean;
}) {
  const router = useRouter();
  const [rescheduling, setRescheduling] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [newTaskHour, setNewTaskHour] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState<string>("");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Attiva il drag solo dopo 5px per non intercettare click sul menu
      activationConstraint: { distance: 5 },
    }),
  );

  // Raggruppo post per ora
  const postsByHour = useMemo(() => {
    const map = new Map<number, Post[]>();
    for (const p of posts) {
      const h = hourOf(p.scheduledAt);
      const bucket = map.get(h);
      if (bucket) bucket.push(p);
      else map.set(h, [p]);
    }
    return map;
  }, [posts]);

  const outOfRange = posts.filter((p) => {
    const h = hourOf(p.scheduledAt);
    return h < 6 || h > 23;
  });

  const handleRefresh = () => router.refresh();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("hour-")) return;
    const newHour = parseInt(overId.slice("hour-".length), 10);
    if (Number.isNaN(newHour)) return;

    const post = posts.find((p) => p.id === String(active.id));
    if (!post || !post.scheduledAt) return;
    if (hourOf(post.scheduledAt) === newHour) return; // stesso slot

    const newIso = withHour(post.scheduledAt, newHour);
    startTransition(async () => {
      try {
        await rescheduleContentDraft(post.id, newIso);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore riprogrammazione");
      }
    });
  }

  function openReschedule(post: Post) {
    if (!post.scheduledAt) return;
    setRescheduleValue(isoToLocalInput(post.scheduledAt));
    setRescheduling(post);
  }

  function confirmReschedule() {
    if (!rescheduling || !rescheduleValue) return;
    const post = rescheduling;
    const newIso = localInputToIso(rescheduleValue);
    setRescheduling(null);
    startTransition(async () => {
      try {
        await rescheduleContentDraft(post.id, newIso);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const post = deleting;
    setDeleting(null);
    startTransition(async () => {
      try {
        await deleteContentDraft(post.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button
            type="button"
            onClick={() => setError(null)}
            className="underline"
            aria-label="Chiudi"
          >
            chiudi
          </button>
        </div>
      )}

      <TaskBanner
        tasks={tasks}
        dayYmd={dayYmd}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
      />

      <DndContext id="calendario-giorno" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-col gap-2">
            {HOURS.map((h) => (
              <HourSlot
                key={h}
                hour={h}
                posts={postsByHour.get(h) ?? []}
                isPast={isPast}
                onReschedule={openReschedule}
                onDelete={setDeleting}
                onNewTask={setNewTaskHour}
              />
            ))}
          </div>
          {outOfRange.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                Fuori orario visualizzato (00-05)
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {outOfRange.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    isPast={isPast}
                    onReschedule={openReschedule}
                    onDelete={setDeleting}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DndContext>

      {/* Dialog riprogramma preciso */}
      {rescheduling && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRescheduling(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-1 text-lg font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Riprogramma post
            </h2>
            <p className="mb-4 text-xs text-text-muted">
              {rescheduling.brandDisplayName} — {truncate(rescheduling.themeInput, 60)}
            </p>
            <label className="block text-xs font-medium text-text">
              Nuova data e ora
              <input
                type="datetime-local"
                value={rescheduleValue}
                min={`${dayYmd}T00:00`}
                onChange={(e) => setRescheduleValue(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduling(null)}
                className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmReschedule}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog nuovo task */}
      {newTaskHour !== null && (
        <NewTaskDialog
          dayYmd={dayYmd}
          hour={newTaskHour}
          users={users}
          onClose={() => setNewTaskHour(null)}
          onCreated={() => {
            setNewTaskHour(null);
            router.refresh();
          }}
        />
      )}

      {/* Dialog conferma delete */}
      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleting(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-1 text-lg font-bold text-danger"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Elimina definitivamente?
            </h2>
            <p className="mb-4 text-sm text-text">
              Il post verrà rimosso in modo <strong>irreversibile</strong>. Non potrai recuperarlo.
            </p>
            <p className="mb-4 rounded-md border border-border bg-surface-muted p-2 text-xs text-text-muted">
              {deleting.brandDisplayName} — {truncate(deleting.themeInput, 80)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NewTaskDialog({
  dayYmd,
  hour,
  users,
  onClose,
  onCreated,
}: {
  dayYmd: string;
  hour: number;
  users: OrgUser[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<OperationalTaskPriority>("important");
  const [assignTo, setAssignTo] = useState("");
  const [dueLocal, setDueLocal] = useState(`${dayYmd}T${pad2(hour)}:00`);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const t = title.trim();
    if (t.length === 0) {
      setError("Titolo obbligatorio");
      return;
    }
    setError(null);
    startTransition(async () => {
      const input: Parameters<typeof createTaskAction>[0] = {
        title: t,
        priority,
        dueAt: localInputToIso(dueLocal),
      };
      const d = description.trim();
      if (d.length > 0) input.description = d;
      if (assignTo) input.assignedTo = assignTo;
      const r = await createTaskAction(input);
      if ("ok" in r && r.ok) {
        onCreated();
      } else {
        setError("error" in r ? r.error : "Errore creazione task");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="mb-1 text-lg font-bold text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Nuovo task
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Pianificato per {dayYmd} alle {pad2(hour)}:00. Apparira anche nella home.
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-text">
            Titolo *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Es. Chiamare Marco pizzeria Centro"
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              autoFocus
            />
          </label>

          <label className="block text-xs font-medium text-text">
            Descrizione (opzionale)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Dettagli, link, note..."
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-text">
              Priorita
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as OperationalTaskPriority)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="urgent">Urgente</option>
                <option value="important">Importante</option>
                <option value="opportunity">Opportunita</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-text">
              Scadenza
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-text">
            Assegna a (opzionale)
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Nessuno (resta sul team)</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "Salvo..." : "Crea task"}
          </button>
        </div>
      </div>
    </div>
  );
}
