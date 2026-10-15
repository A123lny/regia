"use client";

// Client anti-abbandono: leaderboard segnali + azioni resolve/detect.

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle2, X as XIcon } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  detectAbandonmentAction,
  resolveAbandonmentSignalAction,
  ABANDONMENT_KIND_LABELS,
  ABANDONMENT_SEVERITY_STYLES,
} from "@/modules/m09-reminders/public";
import type { AbandonmentSignalRow } from "@/modules/m09-reminders/public";

type Props = {
  signals: AbandonmentSignalRow[];
  canResolve: boolean;
  canDetect: boolean;
};

export function AbandonmentClient({ signals, canResolve, canDetect }: Props) {
  const [pending, startTransition] = useTransition();
  const [detectSummary, setDetectSummary] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canDetect && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted">{detectSummary}</div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await detectAbandonmentAction();
                if (result.ok) {
                  const parts: string[] = [];
                  if (result.skippedWeek.created > 0)
                    parts.push(`${result.skippedWeek.created} skipped week`);
                  if (result.droppedFrequency.created > 0)
                    parts.push(`${result.droppedFrequency.created} freq. dimezzata`);
                  if (result.silenceInactivity.created > 0)
                    parts.push(`${result.silenceInactivity.created} silenzio/inattività`);
                  setDetectSummary(
                    parts.length > 0
                      ? `${result.totalCreated} nuovi segnali: ${parts.join(", ")}`
                      : "Nessun nuovo segnale rilevato",
                  );
                }
              });
            }}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Rilevo..." : "Ricalcola segnali"}
          </Button>
        </div>
      )}

      {signals.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-24 p-3">Priorità</th>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Segnale</th>
                <th className="p-3">Contesto</th>
                {canResolve && <th className="w-32 p-3" />}
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <SignalRow key={s.id} signal={s} canResolve={canResolve} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SignalRow({ signal, canResolve }: { signal: AbandonmentSignalRow; canResolve: boolean }) {
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <tr className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
        <td className="p-3">
          <Badge className={`border ${ABANDONMENT_SEVERITY_STYLES[signal.severity]}`}>
            {signal.severity.toUpperCase()}
          </Badge>
        </td>
        <td className="p-3">
          <BrandChip
            slug={signal.brandSlug}
            name={signal.brandDisplayName}
            color={signal.brandColor}
          />
        </td>
        <td className="p-3">
          <div className="text-sm text-text">
            {signal.contactFullName ?? <span className="italic text-text-muted">senza nome</span>}
          </div>
          {signal.contactEmail && (
            <div className="text-[11px] text-text-muted">{signal.contactEmail}</div>
          )}
        </td>
        <td className="p-3 text-xs">
          <div className="font-medium text-text">{ABANDONMENT_KIND_LABELS[signal.kind]}</div>
          <div className="text-text-muted">
            {signal.previousOrdersCount} → {signal.currentOrdersCount} ordini
          </div>
        </td>
        <td className="p-3 text-xs italic text-text-muted">{signal.notes}</td>
        {canResolve && (
          <td className="p-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReason("");
                setError(null);
                setDialogOpen(true);
              }}
              className="border-success/40 text-success hover:bg-success/10"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Risolvi
            </Button>
          </td>
        )}
      </tr>
      {error && !dialogOpen && (
        <tr>
          <td
            colSpan={6}
            className="border-b border-danger/40 bg-danger/10 p-2 text-xs text-danger"
          >
            {error}
          </td>
        </tr>
      )}
      {dialogOpen && (
        <ResolveDialog
          signal={signal}
          reason={reason}
          setReason={setReason}
          error={error}
          pending={pending}
          onClose={() => setDialogOpen(false)}
          onConfirm={() => {
            if (reason.trim().length < 3) {
              setError("Scrivi almeno 3 caratteri per il motivo");
              return;
            }
            setError(null);
            startTransition(async () => {
              const r = await resolveAbandonmentSignalAction({
                signalId: signal.id,
                reason: reason.trim(),
              });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setDialogOpen(false);
            });
          }}
        />
      )}
    </>
  );
}

function ResolveDialog({
  signal,
  reason,
  setReason,
  error,
  pending,
  onClose,
  onConfirm,
}: {
  signal: AbandonmentSignalRow;
  reason: string;
  setReason: (s: string) => void;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-dialog-title"
        >
          <div
            className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0 flex-1">
                <h2
                  id="resolve-dialog-title"
                  className="text-xl font-bold text-text"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  Risolvi segnale
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <Badge className={`border ${ABANDONMENT_SEVERITY_STYLES[signal.severity]}`}>
                    {signal.severity.toUpperCase()}
                  </Badge>
                  <span>{ABANDONMENT_KIND_LABELS[signal.kind]}</span>
                  {signal.contactFullName && (
                    <span>
                      · <strong>{signal.contactFullName}</strong>
                    </span>
                  )}
                  <span>
                    · {signal.previousOrdersCount} &rarr; {signal.currentOrdersCount} ordini
                  </span>
                </div>
                {signal.notes && (
                  <p className="mt-2 rounded border border-border bg-bg px-2 py-1 text-[11px] italic text-text-muted">
                    Nota segnale: {signal.notes}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
                aria-label="Chiudi"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <label className="block">
                <span className="text-xs font-medium text-text">
                  Motivo + note (min 3 caratteri)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={6}
                  maxLength={1000}
                  placeholder="Es: Chiamato il cliente, mi ha spiegato che il ritardo era dovuto a... Si e' chiarito, torna attivo. Prossimo contatto previsto a dicembre."
                  className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                  autoFocus
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-muted">
                  <span>Verra&apos; salvato in resolved_reason + visibile nello storico</span>
                  <span>{reason.length}/1000</span>
                </div>
              </label>
              {error && (
                <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/40 p-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={pending}
                className="bg-success text-white hover:bg-success/90"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {pending ? "Salvo..." : "Conferma risoluzione"}
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
