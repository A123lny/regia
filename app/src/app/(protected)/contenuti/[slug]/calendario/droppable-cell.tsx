"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import type { ContentDraft } from "@/modules/m03-editorial/public";
import { Badge } from "@/components/ui/badge";

type Props = {
  date: Date;
  dateYmd: string; // usato come id per useDroppable
  drafts: ContentDraft[];
  isPast: boolean;
  brandSlug: string;
};

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function DroppableCell({ date, dateYmd, drafts, isPast, brandSlug }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: dateYmd, disabled: isPast });

  const cellClasses = [
    "flex min-h-[140px] flex-col gap-1 rounded-md border p-2 text-xs transition-colors",
    isPast
      ? "border-border/60 bg-surface-muted/40 text-text-muted/70 cursor-not-allowed"
      : isOver
        ? "border-success bg-success/10"
        : "border-border bg-surface hover:border-border/80",
  ].join(" ");

  return (
    <div
      ref={setNodeRef}
      className={cellClasses}
      aria-label={`Cella ${formatDayHeader(date)}${isPast ? " (passata, non droppable)" : ""}`}
    >
      <div className="mb-1 font-medium text-text-muted">{formatDayHeader(date)}</div>
      {drafts.length === 0 && !isPast && (
        <div className="text-[10px] text-text-muted/60">Trascina qui</div>
      )}
      {drafts.map((d) => (
        <Link
          key={d.id}
          href={`/contenuti/${brandSlug}/${d.id}`}
          className="block rounded border border-border/60 bg-surface-muted/60 p-1.5 hover:border-primary/60"
        >
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <Badge
              className={
                d.status === "published"
                  ? "border border-text-muted/30 bg-text-muted/10 px-1 py-0 text-[9px] text-text-muted"
                  : "border border-primary/30 bg-primary/10 px-1 py-0 text-[9px] text-primary"
              }
            >
              {d.status === "published" ? "Pubblicato" : "Prog."}
            </Badge>
            <span className="text-[10px] text-text-muted">
              {d.scheduledAt ? formatHour(d.scheduledAt) : ""}
            </span>
          </div>
          <div className="text-[11px] font-medium leading-tight text-text">
            {truncate(d.themeInput, 60)}
          </div>
        </Link>
      ))}
    </div>
  );
}
