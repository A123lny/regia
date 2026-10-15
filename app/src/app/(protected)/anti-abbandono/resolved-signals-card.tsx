"use client";

// Card "Risolti 30gg" cliccabile. Apre un dialog con lista storica
// (motivo + note + data risoluzione) usando i signals risolti passati
// dal server component.

import { useState } from "react";
import { CheckCircle2, X as XIcon } from "lucide-react";
import {
  ABANDONMENT_KIND_LABELS,
  ABANDONMENT_SEVERITY_STYLES,
} from "@/modules/m09-reminders/public";
import type { AbandonmentSignalRow } from "@/modules/m09-reminders/public";

type Props = {
  count: number;
  resolvedSignals: AbandonmentSignalRow[];
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResolvedSignalsCard({ count, resolvedSignals }: Props) {
  const [open, setOpen] = useState(false);
  const clickable = resolvedSignals.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => clickable && setOpen(true)}
        disabled={!clickable}
        className={`rounded-xl border border-success/30 bg-success/5 p-4 text-left transition-all ${
          clickable
            ? "cursor-pointer hover:border-success/60 hover:bg-success/10"
            : "cursor-default opacity-80"
        }`}
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Risolti 30gg
          {clickable && (
            <span className="ml-auto text-[9px] font-normal normal-case text-text-muted">
              click per storico
            </span>
          )}
        </div>
        <div
          className="mt-1 text-3xl font-bold text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {count}
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolved-modal-title"
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <h2
                  id="resolved-modal-title"
                  className="text-xl font-bold text-text"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  Storico risolti
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Ultimi {resolvedSignals.length} segnali risolti (max 50 piu&apos; recenti)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
                aria-label="Chiudi"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {resolvedSignals.length === 0 ? (
                <div className="p-8 text-center text-sm italic text-text-muted">
                  Nessun segnale risolto ancora.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="p-3">Risolto</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Segnale</th>
                      <th className="p-3">Motivo + note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedSignals.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/60 last:border-0 hover:bg-surface-muted/50"
                      >
                        <td className="p-3 align-top text-xs text-text-muted whitespace-nowrap">
                          {s.resolvedAt ? formatDateTime(s.resolvedAt) : "—"}
                        </td>
                        <td className="p-3 align-top">
                          <div className="text-sm text-text">
                            {s.contactFullName ?? (
                              <span className="italic text-text-muted">senza nome</span>
                            )}
                          </div>
                          {s.contactEmail && (
                            <div className="text-[11px] text-text-muted">{s.contactEmail}</div>
                          )}
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${ABANDONMENT_SEVERITY_STYLES[s.severity]}`}
                            >
                              {s.severity}
                            </span>
                            <span className="text-xs text-text">
                              {ABANDONMENT_KIND_LABELS[s.kind]}
                            </span>
                            {(s.previousOrdersCount > 0 || s.currentOrdersCount > 0) && (
                              <span className="text-[11px] text-text-muted">
                                {s.previousOrdersCount} &rarr; {s.currentOrdersCount} ordini
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 align-top">
                          {s.resolvedReason && (
                            <div className="text-sm text-text">
                              <strong>Motivo:</strong> {s.resolvedReason}
                            </div>
                          )}
                          {s.notes && (
                            <div className="mt-1 rounded border border-border bg-bg px-2 py-1 text-[11px] italic text-text-muted">
                              {s.notes}
                            </div>
                          )}
                          {!s.resolvedReason && !s.notes && (
                            <span className="text-xs italic text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
