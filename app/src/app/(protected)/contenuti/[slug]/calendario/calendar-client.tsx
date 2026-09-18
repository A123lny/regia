"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { scheduleContentDraft } from "@/modules/m03-editorial/public";
import type { ContentDraft } from "@/modules/m03-editorial/public";
import { BiweeklyGrid } from "./biweekly-grid";
import { ApprovedDrawer } from "./approved-drawer";

type Props = {
  brandSlug: string;
  startDateIso: string;
  scheduled: ContentDraft[];
  approved: ContentDraft[];
};

export function CalendarClient({ brandSlug, startDateIso, scheduled, approved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function onDragEnd(ev: DragEndEvent) {
    setError(null);
    if (!ev.over) return;
    const draftId = String(ev.active.id);
    const dateYmd = String(ev.over.id); // formato YYYY-MM-DD (dallo droppable)
    if (!dateYmd || !draftId) return;

    // Programma per le 09:00 locale del giorno scelto.
    const parts = dateYmd.split("-").map((s) => Number(s));
    const y = parts[0] ?? 0;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const target = new Date(y, m - 1, d, 9, 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      setError("Non puoi programmare per una data passata");
      return;
    }
    setBusy(true);
    try {
      await scheduleContentDraft(draftId, target.toISOString());
      // revalidatePath dentro l'action — la RSC parent viene rirenderizzata al successivo navigate.
      // Per feedback immediato in questa vista, ricarichiamo la pagina.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <BiweeklyGrid startDateIso={startDateIso} scheduled={scheduled} brandSlug={brandSlug} />
        <ApprovedDrawer approved={approved} brandSlug={brandSlug} />
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger shadow-lg">
          {error}
        </div>
      )}
      {busy && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-surface p-3 text-sm text-text-muted shadow-lg">
          Programmazione in corso…
        </div>
      )}
    </DndContext>
  );
}
