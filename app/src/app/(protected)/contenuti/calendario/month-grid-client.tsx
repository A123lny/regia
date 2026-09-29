"use client";

// Griglia mensile cross-brand con drag&drop tra giorni.
// - Cella giorno = useDroppable (id = ymd); disabled se giorno passato.
// - Pillola post = useDraggable (id = post.id); disabled se published o giorno passato.
// - Al drop: nuovo scheduled_at = data del giorno destinazione + ora/minuti originali del post.
// - Click (senza drag ≥5px) apre la modal quick-view (comportamento pre-esistente).

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarCheck2, X, ExternalLink, Calendar } from "lucide-react";
import { rescheduleContentDraft } from "@/modules/m03-editorial/public";

const FALLBACK_COLOR = "#7a6857";

export type MonthPost = {
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

type Props = {
  daysIso: string[]; // ISO di ogni giorno della griglia (14 giorni)
  posts: MonthPost[]; // gia filtrati nel range
  todayYmd: string;
};

function toYmd(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(iso: string): { weekday: string; day: number; month: string } {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("it-IT", { weekday: "short" }),
    day: d.getDate(),
    month: d.toLocaleDateString("it-IT", { month: "short" }),
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// Costruisce un nuovo ISO combinando la data del giorno destinazione (ymd, local)
// con l'ora/minuti/secondi del post originale (scheduled_at).
function combineDayWithTime(ymdLocal: string, originalIso: string): string {
  const parts = ymdLocal.split("-").map((n) => parseInt(n, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const orig = new Date(originalIso);
  if (y === undefined || m === undefined || d === undefined) return originalIso;
  const newDate = new Date(
    y,
    m - 1,
    d,
    orig.getHours(),
    orig.getMinutes(),
    orig.getSeconds(),
    orig.getMilliseconds(),
  );
  return newDate.toISOString();
}

function DraggablePill({
  post,
  onOpen,
  disabled,
}: {
  post: MonthPost;
  onOpen: (p: MonthPost) => void;
  disabled: boolean;
}) {
  const color = post.brandColor || FALLBACK_COLOR;
  const name = post.brandDisplayName;
  const published = post.status === "published";
  const canDrag = !disabled && !published;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    borderLeftWidth: 3,
    borderLeftColor: color,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={() => {
        if (!isDragging) onOpen(post);
      }}
      className={`block w-full rounded-md border border-border px-1.5 py-1 text-left text-[11px] transition-colors hover:border-primary/50 hover:bg-surface-muted ${
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${published ? "opacity-70" : ""}`}
      title={`${name} · ${post.themeInput}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium text-text">
          {post.scheduledAt ? formatTime(post.scheduledAt) : "—"}
        </span>
        {published && <CalendarCheck2 className="h-3 w-3 text-text-muted" />}
      </div>
      <div className="mt-0.5 truncate text-text-muted">{truncate(post.themeInput, 32)}</div>
    </button>
  );
}

function DroppableDayCell({
  dayIso,
  ymd,
  isDayToday,
  isPast,
  items,
  onOpenPost,
}: {
  dayIso: string;
  ymd: string;
  isDayToday: boolean;
  isPast: boolean;
  items: MonthPost[];
  onOpenPost: (p: MonthPost) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: ymd, disabled: isPast });
  const label = formatDayLabel(dayIso);

  const border = isDayToday
    ? "border-primary bg-primary/5"
    : isOver
      ? "border-primary bg-primary/10"
      : isPast
        ? "border-border/60 bg-surface-muted/40"
        : "border-border bg-surface";

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] rounded-lg border p-2 transition-colors ${border}`}
    >
      <Link
        href={`/contenuti/calendario/${ymd}`}
        className="mb-2 flex items-baseline justify-between border-b border-border pb-1 transition-colors hover:text-primary"
        aria-label={`Apri il giorno ${label.day} ${label.month}`}
      >
        <div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            {label.weekday}
          </span>{" "}
          <span
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {label.day}
          </span>
          <span className="ml-1 text-[10px] text-text-muted">{label.month}</span>
        </div>
        {items.length > 0 && (
          <span className="text-[10px] font-medium text-text-muted">{items.length}</span>
        )}
      </Link>
      {items.length === 0 ? (
        <div className="py-2 text-center text-[10px] text-text-muted/60">
          {isOver ? "Rilascia qui" : isPast ? "" : "—"}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((p) => (
            <DraggablePill key={p.id} post={p} onOpen={onOpenPost} disabled={isPast} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MonthGridClient({ daysIso, posts, todayYmd }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<MonthPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byDay = useMemo(() => {
    const map = new Map<string, MonthPost[]>();
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      const key = toYmd(p.scheduledAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(p);
      else map.set(key, [p]);
    }
    return map;
  }, [posts]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetYmd = String(over.id);
    const post = posts.find((p) => p.id === String(active.id));
    if (!post || !post.scheduledAt) return;
    const currentYmd = toYmd(post.scheduledAt);
    if (currentYmd === targetYmd) return; // stesso giorno, nulla da fare

    const newIso = combineDayWithTime(targetYmd, post.scheduledAt);
    startTransition(async () => {
      try {
        await rescheduleContentDraft(post.id, newIso);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore riprogrammazione");
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

      <DndContext id="calendario-mensile" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {daysIso.map((dayIso) => {
            const ymd = toYmd(dayIso);
            const items = byDay.get(ymd) ?? [];
            const isDayToday = ymd === todayYmd;
            const isPast = ymd < todayYmd;
            return (
              <DroppableDayCell
                key={ymd}
                dayIso={dayIso}
                ymd={ymd}
                isDayToday={isDayToday}
                isPast={isPast}
                items={items}
                onOpenPost={setSelected}
              />
            );
          })}
        </div>
      </DndContext>

      {selected && <PostPreviewDialog post={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function PostPreviewDialog({ post, onClose }: { post: MonthPost; onClose: () => void }) {
  const color = post.brandColor || FALLBACK_COLOR;
  const name = post.brandDisplayName;
  const published = post.status === "published";
  const when = post.publishedAt ?? post.scheduledAt;
  const dayYmd = when ? toYmd(when) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-preview-title"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {name}
              </span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  published
                    ? "border border-text-muted/30 bg-text-muted/10 text-text-muted"
                    : "border border-primary/30 bg-primary/10 text-primary"
                }`}
              >
                {published ? "Pubblicato" : "Programmato"}
              </span>
            </div>
            <h2
              id="post-preview-title"
              className="mt-2 text-xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {post.themeInput.replace(/^\[SEED\]\s*/, "")}
            </h2>
            {when && <p className="mt-1 text-xs text-text-muted">{formatFullDateTime(when)}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
            aria-label="Chiudi anteprima"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
            {post.generatedText}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted/40 p-4">
          {dayYmd && (
            <Link
              href={`/contenuti/calendario/${dayYmd}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/50"
            >
              <Calendar className="h-3.5 w-3.5" /> Apri giorno
            </Link>
          )}
          <Link
            href={`/contenuti/${post.brandSlug}/${post.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Apri dettaglio
          </Link>
        </div>
      </div>
    </div>
  );
}
