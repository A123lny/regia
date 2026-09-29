"use client";

// Client anti-abbandono: leaderboard segnali + azioni resolve/detect.

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("Cliente ricontattato");
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
            {!expanded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
                className="border-success/40 text-success hover:bg-success/10"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Risolvi
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo"
                  maxLength={200}
                  className="w-32 rounded-md border border-border bg-bg px-1.5 py-1 text-xs focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const r = await resolveAbandonmentSignalAction({
                        signalId: signal.id,
                        reason: reason.trim(),
                      });
                      if (!r.ok) setError(r.error);
                    });
                  }}
                  className="rounded-md bg-success p-1.5 text-white hover:bg-success/90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </td>
        )}
      </tr>
      {error && (
        <tr>
          <td
            colSpan={6}
            className="border-b border-danger/40 bg-danger/10 p-2 text-xs text-danger"
          >
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
