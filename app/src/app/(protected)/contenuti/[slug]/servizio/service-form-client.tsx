"use client";

// Form corsia veloce (RF-3.4).
// Textarea single-shot: input → generateServiceCommunication → redirect al draft creato.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { generateServiceCommunication } from "@/modules/m03-editorial/public";

const EXAMPLES = [
  "chiuso venerdi 27 per formazione, riapertura sabato mattina",
  "domenica orario ridotto 8-14",
  "stop consegne oggi zone alte per neve, riprendiamo domani",
  "cambio gomme prenotabili fino al 31 ottobre",
];

export function ServiceFormClient({ brandId, brandSlug }: { brandId: string; brandSlug: string }) {
  const router = useRouter();
  const [input, setInput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();

  const canSubmit = input.trim().length >= 3 && input.trim().length <= 500 && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateServiceCommunication(brandId, input);
        if (result.ok) {
          router.push(`/contenuti/${brandSlug}/${result.draft.id}`);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore imprevisto");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-2xl">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-warning" />
            <h3
              className="mb-2 text-lg font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Genero il post di servizio
            </h3>
            <p className="text-sm text-text-muted">Pochi secondi.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="ownerInput"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted"
        >
          Dettami la situazione (poche parole bastano)
        </label>
        <textarea
          id="ownerInput"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="es. chiuso venerdi 27 per formazione, riapertura sabato mattina"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
          autoFocus
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
          <span>Min 3, max 500 caratteri.</span>
          <span>{input.trim().length}/500</span>
        </div>
      </div>

      {/* Esempi cliccabili per velocizzare */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Esempi (clicca per compilare)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setInput(ex)}
              disabled={submitting}
              className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] text-text-muted hover:border-primary/40 hover:text-text disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] text-text-muted">
          Costo stimato: ~0.001$ · Rispetta brand voice ma senza linguaggio promozionale.
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-warning px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          {submitting ? "Genero..." : "Genera post di servizio"}
        </button>
      </div>
    </form>
  );
}
