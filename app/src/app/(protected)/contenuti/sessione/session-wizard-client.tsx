"use client";

// Wizard sessione RF-3.6: scorre bozze una alla volta.
// Azioni per bozza: Approva · Rifiuta (con motivo) · Salta.
// Progress: "3/14 · 2 approvate · 1 rifiutata · 1 saltata".
// Al termine schermata completamento.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, SkipForward, ChevronLeft, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { approveContentDraft, rejectContentDraft } from "@/modules/m03-editorial/public";
import type { SessionDraft } from "@/modules/m03-editorial/public";

type Props = {
  initialDrafts: SessionDraft[];
};

type Decision = "approved" | "rejected" | "skipped";

export function SessionWizardClient({ initialDrafts }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const total = initialDrafts.length;
  const current = initialDrafts[currentIndex];
  const stats = {
    approved: [...decisions.values()].filter((d) => d === "approved").length,
    rejected: [...decisions.values()].filter((d) => d === "rejected").length,
    skipped: [...decisions.values()].filter((d) => d === "skipped").length,
  };
  const allDone = decisions.size === total;

  function markDecision(id: string, d: Decision) {
    const next = new Map(decisions);
    next.set(id, d);
    setDecisions(next);
    if (currentIndex < total - 1) setCurrentIndex(currentIndex + 1);
  }

  function handleApprove(draft: SessionDraft) {
    setError(null);
    startTransition(async () => {
      try {
        await approveContentDraft(draft.id);
        markDecision(draft.id, "approved");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore approvazione");
      }
    });
  }

  function handleReject(draft: SessionDraft) {
    if (rejectReason.trim().length < 3) {
      setError("Motivo del rifiuto obbligatorio (min 3 caratteri) — serve al sistema per imparare");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectContentDraft(draft.id, rejectReason.trim());
        setRejectingId(null);
        setRejectReason("");
        markDecision(draft.id, "rejected");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore rifiuto");
      }
    });
  }

  function handleSkip(draft: SessionDraft) {
    markDecision(draft.id, "skipped");
  }

  // Schermata di completamento
  if (allDone || !current) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-success/30 bg-success/5 p-10 text-center">
          <Check className="mx-auto mb-3 h-12 w-12 text-success" />
          <h2
            className="mb-2 text-2xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Sessione completata
          </h2>
          <p className="mb-6 text-sm text-text-muted">
            {stats.approved} approvate · {stats.rejected} rifiutate · {stats.skipped} saltate
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/contenuti/calendario"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Vai al calendario per programmare
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-surface-muted"
            >
              Torna alla home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span>
            Bozza <strong className="text-text">{currentIndex + 1}</strong> di{" "}
            <strong className="text-text">{total}</strong>
          </span>
          <span>
            <span className="text-success">{stats.approved} approvate</span>
            {" · "}
            <span className="text-danger">{stats.rejected} rifiutate</span>
            {" · "}
            <span className="text-text-muted">{stats.skipped} saltate</span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
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

      {/* Draft card */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {/* Bar colorata brand */}
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: current.brandColor }}
          aria-hidden="true"
        />
        <div className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: current.brandColor }}
                aria-hidden="true"
              />
              {current.brandDisplayName}
            </span>
            <Link
              href={`/contenuti/${current.brandSlug}/${current.id}`}
              className="ml-auto inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary"
            >
              Apri dettaglio <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <h3
            className="mb-2 text-xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {current.themeInput.replace(/^\[[^\]]+\]\s*/, "")}
          </h3>
          <div className="whitespace-pre-wrap rounded-md border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed text-text">
            {current.generatedText}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-text-muted">
            <Sparkles className="h-3 w-3" />
            <span>{current.modelUsed}</span>
            <span>·</span>
            <span>${current.costUsd.toFixed(4)}</span>
            <span>·</span>
            <span>{current.latencyMs}ms</span>
          </div>
        </div>

        {/* Azioni */}
        <div className="border-t border-border bg-surface-muted/30 p-4">
          {rejectingId === current.id ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text">
                Motivo del rifiuto (obbligatorio, serve al sistema per imparare — RF-3.8)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="es. tono troppo formale · non e la stagione giusta · promo non conforme"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null);
                    setRejectReason("");
                  }}
                  disabled={busy}
                  className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(current)}
                  disabled={busy || rejectReason.trim().length < 3}
                  className="inline-flex items-center gap-1 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Rifiuta
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
                disabled={currentIndex === 0 || busy}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" /> Precedente
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSkip(current)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:opacity-50"
                >
                  <SkipForward className="h-4 w-4" /> Salta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(current.id);
                    setRejectReason("");
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/5 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Rifiuta
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(current)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md bg-success px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Approva
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-text-muted">
        Tip: usa &quot;Salta&quot; se non sei sicuro — le bozze restano in stato draft e le rivedrai
        alla prossima sessione. Usa{" "}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="underline hover:text-primary"
        >
          Home
        </button>{" "}
        per uscire mantenendo lo stato.
      </p>
    </div>
  );
}
