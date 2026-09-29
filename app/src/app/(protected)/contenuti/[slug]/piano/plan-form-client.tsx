"use client";

// Form generazione piano editoriale (RF-3.1).
// UX: blocking con spinner grande + messaggio "puo richiedere 1-3 minuti".
// Al successo redirect a /contenuti/[slug]?planBatchId=xxx.
// In caso di partial (piano interrotto), mostra warning + link al partial batch.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { generateEditorialPlan } from "@/modules/m03-editorial/public";

type PillarLite = { id: string; name: string; weight: number };

type Props = {
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  pillars: PillarLite[];
  defaultStartDate: string; // yyyy-mm-dd
};

const NUM_DRAFTS_OPTIONS = [7, 14, 21, 28];

export function PlanFormClient({ brandId, brandSlug, pillars, defaultStartDate }: Props) {
  const router = useRouter();
  const [numDrafts, setNumDrafts] = useState<number>(14);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ message: string; batchId: string } | null>(null);
  const [submitting, startTransition] = useTransition();

  const usableCount = pillars.length - excludedIds.size;
  const canSubmit = usableCount >= 1 && numDrafts >= 1 && numDrafts <= 30 && !submitting;

  function togglePillar(id: string) {
    const next = new Set(excludedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcludedIds(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    startTransition(async () => {
      try {
        const startIso = new Date(startDate + "T00:00:00").toISOString();
        const result = await generateEditorialPlan({
          brandId,
          numDrafts,
          startDateIso: startIso,
          excludedPillarIds: Array.from(excludedIds),
        });
        if (result.ok) {
          router.push(`/contenuti/${brandSlug}?planBatchId=${result.planBatchId}`);
        } else if (result.partialBatchId) {
          setWarning({ message: result.error, batchId: result.partialBatchId });
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore imprevisto");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Overlay durante la generazione */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-2xl">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h3
              className="mb-2 text-lg font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Generazione piano in corso
            </h3>
            <p className="text-sm text-text-muted">
              {numDrafts} bozze in coda. Puo richiedere da 1 a 3 minuti.
              <br />
              Non chiudere la pagina.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{warning.message}</p>
              <button
                type="button"
                onClick={() =>
                  router.push(`/contenuti/${brandSlug}?planBatchId=${warning.batchId}`)
                }
                className="mt-1 underline hover:text-primary"
              >
                Vai alle bozze parziali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Numero bozze */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Numero di bozze
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {NUM_DRAFTS_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumDrafts(n)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                numDrafts === n
                  ? "bg-primary text-white"
                  : "border border-border bg-surface text-text hover:bg-surface-muted"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-text-muted">o</span>
          <input
            type="number"
            min={1}
            max={30}
            value={numDrafts}
            onChange={(e) => setNumDrafts(Number(e.target.value))}
            className="w-20 rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
          />
        </div>
        <p className="mt-1 text-[11px] text-text-muted">
          Consigliato 14 (~2 settimane, 1 al giorno). Range 1-30.
        </p>
      </div>

      {/* Data inizio */}
      <div>
        <label
          htmlFor="startDate"
          className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted"
        >
          Data inizio (giorno 1 del piano)
        </label>
        <input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-text-muted">
          Le bozze coprono {numDrafts} giorni consecutivi da questa data.
        </p>
      </div>

      {/* Pilastri */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Pilastri disponibili ({usableCount}/{pillars.length} attivi)
        </label>
        <p className="mb-3 text-[11px] text-text-muted">
          Deseleziona i pilastri che vuoi escludere da questo piano. Ognuno esce piu spesso in base
          al suo peso.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pillars.map((p) => {
            const excluded = excludedIds.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 transition-colors ${
                  excluded
                    ? "border-border bg-surface-muted/40 opacity-60"
                    : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!excluded} onChange={() => togglePillar(p.id)} />
                  <span className="text-sm font-medium text-text">{p.name}</span>
                </div>
                <span className="text-xs text-text-muted">peso {p.weight}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-text-muted">
          Costo stimato: ~{(numDrafts * 0.001).toFixed(3)}$ (Anthropic Sonnet).
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {submitting ? "Generazione..." : `Genera ${numDrafts} bozze`}
        </button>
      </div>
    </form>
  );
}
