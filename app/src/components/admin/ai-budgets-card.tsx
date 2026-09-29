"use client";

// RF-11.5 Card tetti spesa AI in Impostazioni.
// Owner-only. Mostra spent/cap per categoria + form inline per settare cap.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, AlertTriangle, Loader2, Pencil } from "lucide-react";
import { saveAiBudget } from "@/modules/m11-admin/public";
import type { SpendSummary, BudgetCategory } from "@/modules/m11-admin/public";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Gemini (Google)",
  voyage: "Voyage (embeddings)",
  all: "Tetto totale (tutte le AI)",
};

export function AiBudgetsCard({ summaries }: { summaries: SpendSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <Wallet className="h-5 w-5 text-primary" /> Tetti spesa AI
        </CardTitle>
        <CardDescription>
          RF-11.5: cap mensile per categoria. Quando raggiunto, la generazione viene bloccata
          (guardia server-side). Reset automatico al primo del mese.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {summaries.map((s) => (
          <BudgetRow key={s.category} summary={s} />
        ))}
      </CardContent>
    </Card>
  );
}

function BudgetRow({ summary }: { summary: SpendSummary }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cap, setCap] = useState(summary.capUsd?.toString() ?? "");
  const [threshold, setThreshold] = useState(String(summary.alertThresholdPercent));
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const capNum = Number(cap);
  const canSave = !isNaN(capNum) && capNum >= 0 && capNum <= 10000;
  const isOverThreshold =
    summary.capUsd !== null && summary.percentUsed >= summary.alertThresholdPercent;
  const isExhausted = summary.capUsd !== null && summary.percentUsed >= 100;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveAiBudget({
          category: summary.category,
          monthlyCapUsd: capNum,
          alertThresholdPercent: Number(threshold),
          isActive: capNum > 0,
        });
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  const barColor = isExhausted ? "bg-danger" : isOverThreshold ? "bg-warning" : "bg-success";

  return (
    <div
      className={`rounded-md border p-3 ${
        isExhausted
          ? "border-danger/40 bg-danger/5"
          : isOverThreshold
            ? "border-warning/40 bg-warning/5"
            : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{CATEGORY_LABELS[summary.category]}</span>
          {isExhausted && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-danger/30 bg-danger/10 px-1.5 py-0 text-[10px] font-medium text-danger">
              <AlertTriangle className="h-3 w-3" /> esaurito
            </span>
          )}
          {isOverThreshold && !isExhausted && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0 text-[10px] font-medium text-warning">
              soglia allarme
            </span>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md p-1 text-text-muted hover:bg-surface-muted"
            aria-label="Modifica cap"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-2">
          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-medium text-text-muted">Cap mensile ($)</span>
              <input
                type="number"
                min={0}
                max={10000}
                step={0.01}
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-primary focus:outline-none"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-medium text-text-muted">Soglia allarme %</span>
              <input
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setCap(summary.capUsd?.toString() ?? "");
                setThreshold(String(summary.alertThresholdPercent));
                setError(null);
              }}
              disabled={busy}
              className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={busy || !canSave}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Salva
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-text">
              <strong>${summary.spentThisMonthUsd.toFixed(4)}</strong>
              {summary.capUsd !== null && (
                <span className="text-text-muted"> / ${summary.capUsd.toFixed(2)} mese</span>
              )}
            </span>
            {summary.capUsd !== null ? (
              <span className="text-text-muted">{summary.percentUsed}%</span>
            ) : (
              <span className="text-text-muted italic">nessun cap</span>
            )}
          </div>
          {summary.capUsd !== null && summary.capUsd > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, summary.percentUsed)}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
