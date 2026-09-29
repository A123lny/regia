"use client";

// Form inline per richiedere foto/video per una bozza (RF-3.9).
// Sotto il dettaglio draft. Click "Richiedi materiale" apre form compatto.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Plus, X } from "lucide-react";
import { createMaterialRequest } from "@/modules/m03-editorial/public";

export function MaterialRequestForm({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createMaterialRequest({
          draftId,
          description,
          ...(neededByDate ? { neededByDate } : {}),
          ...(assignedTo ? { assignedTo } : {}),
        });
        setDescription("");
        setNeededByDate("");
        setAssignedTo("");
        setOpen(false);
        router.refresh();
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "Errore");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted hover:border-primary/40 hover:text-text"
      >
        <Camera className="h-3.5 w-3.5" /> Richiedi foto o video per questa bozza
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <span
            className="text-sm font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Nuova richiesta materiale
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-text-muted hover:bg-surface-muted"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block">
          <span className="text-[11px] font-medium text-text-muted">Cosa serve</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={3}
            maxLength={500}
            placeholder="es. foto del panino Diamond Cheese sullo sfondo del banco"
            className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
            autoFocus
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-text-muted">Entro il (opzionale)</span>
            <input
              type="date"
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-text-muted">A chi (opzionale)</span>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              maxLength={100}
              placeholder="es. Marco (cucina)"
              className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-md px-2.5 py-1 text-xs text-text-muted hover:bg-surface-muted disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={busy || description.trim().length < 3}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {busy ? "Creo..." : "Crea richiesta"}
          </button>
        </div>
      </form>
    </div>
  );
}
