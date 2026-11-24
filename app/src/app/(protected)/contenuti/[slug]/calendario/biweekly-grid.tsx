"use client";

import type { ContentDraft } from "@/modules/m03-editorial/public";
import { DroppableCell } from "./droppable-cell";

type Props = {
  startDateIso: string;
  scheduled: ContentDraft[];
  brandSlug: string;
};

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameLocalDate(iso: string, target: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

export function BiweeklyGrid({ startDateIso, scheduled, brandSlug }: Props) {
  const startDate = new Date(startDateIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(startDate, i);
    const dateYmd = toYmd(date);
    const draftsInDay = scheduled.filter(
      (d) => d.scheduledAt && sameLocalDate(d.scheduledAt, date),
    );
    const isPast = date < today;
    return { date, dateYmd, draftsInDay, isPast };
  });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {cells.map(({ date, dateYmd, draftsInDay, isPast }) => (
        <DroppableCell
          key={dateYmd}
          date={date}
          dateYmd={dateYmd}
          drafts={draftsInDay}
          isPast={isPast}
          brandSlug={brandSlug}
        />
      ))}
    </div>
  );
}
