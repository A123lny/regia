"use client";

// RF-11.4 Card interruttore arresto AI in Impostazioni.
// Owner-only (team.manage capability). Bottone rosso con conferma.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, AlertTriangle, Loader2 } from "lucide-react";
import { toggleAiKillSwitch } from "@/modules/m11-admin/public";
import type { AiSafetyStatus } from "@/modules/m11-admin/public";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AiKillSwitchCard({ initialStatus }: { initialStatus: AiSafetyStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function handleActivate() {
    setError(null);
    startTransition(async () => {
      const res = await toggleAiKillSwitch(true, reason);
      if (res.ok) {
        setStatus({
          killSwitchOn: true,
          killSwitchUpdatedAt: new Date().toISOString(),
          killSwitchReason: reason.trim() || null,
        });
        setShowReasonForm(false);
        setReason("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleDeactivate() {
    if (!confirm("Riattivare le generazioni AI?")) return;
    setError(null);
    startTransition(async () => {
      const res = await toggleAiKillSwitch(false);
      if (res.ok) {
        setStatus({
          killSwitchOn: false,
          killSwitchUpdatedAt: new Date().toISOString(),
          killSwitchReason: null,
        });
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card
      className={`border-2 ${
        status.killSwitchOn ? "border-danger bg-danger/5" : "border-border bg-surface"
      }`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          {status.killSwitchOn ? (
            <>
              <PowerOff className="h-5 w-5 text-danger" /> AI sospesa
            </>
          ) : (
            <>
              <Power className="h-5 w-5 text-success" /> AI attiva
            </>
          )}
        </CardTitle>
        <CardDescription>
          RF-11.4: interruttore di arresto per bloccare TUTTE le generazioni AI (testo social, piano
          editoriale, comunicazioni di servizio, ricorrenze). Effetto immediato. Non blocca le
          funzioni interne come rendering template (satori/resvg).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {status.killSwitchOn ? (
          <div className="space-y-3">
            <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div className="flex-1">
                  <div className="font-medium text-danger">
                    Generazioni AI sospese dall&apos;Owner
                  </div>
                  {status.killSwitchReason && (
                    <div className="mt-1 text-text-muted">
                      Motivo: <em>{status.killSwitchReason}</em>
                    </div>
                  )}
                  <div className="mt-1 text-xs text-text-muted">
                    Attivato: {formatDateTime(status.killSwitchUpdatedAt)}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Riattiva AI
            </button>
          </div>
        ) : showReasonForm ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-text">
                Motivo (opzionale, aiuta a ricordarsi perche)
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="es. credito Anthropic esaurito, staff in formazione, ecc."
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReasonForm(false);
                  setReason("");
                }}
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                Conferma STOP
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              Le generazioni AI stanno funzionando normalmente.
            </p>
            <button
              type="button"
              onClick={() => setShowReasonForm(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border-2 border-danger bg-danger/5 px-4 py-2 text-sm font-bold text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <PowerOff className="h-4 w-4" /> STOP TUTTE LE AI
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
