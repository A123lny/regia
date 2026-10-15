// M9 Anti-abbandono — RN-40 + RF-9.x struttura.

import { notFound } from "next/navigation";
import { UserX, AlertTriangle, AlertCircle } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listAbandonmentSignals,
  listResolvedAbandonmentSignals,
  getAbandonmentStats,
} from "@/modules/m09-reminders/public";
import { HelpButton } from "@/components/help/help-button";
import { AbandonmentClient } from "./abandonment-client";
import { ResolvedSignalsCard } from "./resolved-signals-card";

export default async function AntiAbbandonoPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "abandonment.read")) notFound();

  const [signals, resolvedSignals, stats] = await Promise.all([
    listAbandonmentSignals(session.organizationId, true, 200),
    listResolvedAbandonmentSignals(session.organizationId, 50),
    getAbandonmentStats(session.organizationId),
  ]);

  const canResolve = hasCapability(session.role, "abandonment.resolve");
  const canDetect = hasCapability(session.role, "abandonment.detect");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserX className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Anti-abbandono
            </h1>
          </div>
          <HelpButton pageKey="anti-abbandono" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          RN-40: nella spesa a domicilio, perdere un abituale vale più di un ordine mancato. Il
          rilevatore genera segnali quando un cliente cambia pattern.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-danger">
            <AlertCircle className="h-3.5 w-3.5" /> Alta priorità
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.activeHigh}
          </div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Media priorità
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.activeMedium}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">Bassa</div>
          <div
            className="mt-1 text-3xl font-bold text-text-muted"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.activeLow}
          </div>
        </div>
        <ResolvedSignalsCard count={stats.resolvedLast30d} resolvedSignals={resolvedSignals} />
      </div>

      <AbandonmentClient signals={signals} canResolve={canResolve} canDetect={canDetect} />

      {signals.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun segnale attivo.{canDetect && " Prova a ricalcolare per scannerizzare i pattern."}
        </div>
      )}
    </div>
  );
}
