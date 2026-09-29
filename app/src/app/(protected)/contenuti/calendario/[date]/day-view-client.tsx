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
import { MoreVertical, ExternalLink, Clock, CalendarX, Trash2 } from "lucide-react";
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
function localInputToIso(local: string): string {
  return new Date(local).toISOString();
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

function HourSlot({
  hour,
  posts,
  isPast,
  onReschedule,
  onDelete,
}: {
  hour: number;
  posts: Post[];
  isPast: boolean;
  onReschedule: (post: Post) => void;
  onDelete: (post: Post) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `hour-${hour}`,
    disabled: isPast,
  });

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
              : "border-border/60 bg-surface"
        }`}
      >
        {posts.length === 0 ? (
          <div className="flex h-full min-h-[52px] items-center justify-center text-[10px] text-text-muted/50">
            {isPast ? "" : isOver ? "Rilascia qui" : "—"}
          </div>
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
          </div>
        )}
      </div>
    </div>
  );
}

export function DayViewClient({
  posts,
  dayYmd,
  isPast,
}: {
  posts: Post[];
  dayYmd: string;
  isPast: boolean;
}) {
  const router = useRouter();
  const [rescheduling, setRescheduling] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState<string>("");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Attiva il drag solo dopo 5px per non intercettare click sul menu
      activationConstraint: { distance: 5 },
    }),
  );

  // Raggruppo per ora
  const byHour = useMemo(() => {
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

      <DndContext id="calendario-giorno" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-col gap-2">
            {HOURS.map((h) => (
              <HourSlot
                key={h}
                hour={h}
                posts={byHour.get(h) ?? []}
                isPast={isPast}
                onReschedule={openReschedule}
                onDelete={setDeleting}
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
