"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ContentDraft } from "@/modules/m03-editorial/public";

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function DraggableCard({ draft }: { draft: ContentDraft }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draft.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-md border border-border bg-surface p-2 shadow-sm hover:border-primary/60 active:cursor-grabbing"
      aria-label={`Trascina il contenuto: ${draft.themeInput.slice(0, 40)}`}
    >
      <div className="text-[11px] font-medium leading-tight text-text">
        {truncate(draft.themeInput, 80)}
      </div>
      <div className="mt-1 text-[10px] text-text-muted">{truncate(draft.generatedText, 60)}</div>
    </div>
  );
}
