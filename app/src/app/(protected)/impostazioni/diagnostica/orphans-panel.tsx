"use client";

// Pannello "Render Creatomate orfani" dentro la Diagnostica.
// Trova i render che hanno un audit event di start per questa org MA
// non hanno una row in creatomate_renders (insert fallito al momento,
// tipicamente perché la migration non era ancora applicata).
//
// Per ogni orfano il sistema prova in sequenza:
//  1. ricava brand dall'audit event (nuovi render)
//  2. ricava brand dai metadata Creatomate (render senza audit brandId)
//  3. se ancora non trovato, mostra un dropdown per scelta manuale
//
// "Recupera tutti" processa in batch i primi 2 casi; il terzo richiede
// che l'utente scelga il brand e prema "Recupera con questo marchio".

import { useState, useTransition, useEffect } from "react";
import { Loader2, Search, Wrench, Check, AlertCircle } from "lucide-react";
import {
  findOrphanCreatomateRendersAction,
  recoverAllOrphansAction,
  recoverOrphanWithBrandAction,
  type OrphanRow,
  type OrphanBrand,
} from "./orphans-actions";

export function OrphansPanel() {
  const [orphans, setOrphans] = useState<OrphanRow[] | null>(null);
  const [brands, setBrands] = useState<OrphanBrand[]>([]);
  const [manualBrand, setManualBrand] = useState<Record<string, string>>({});
  const [manualResult, setManualResult] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    recovered: number;
    failed: number;
    details: Array<{ externalId: string; result: string }>;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    scan();
  }, []);

  function scan() {
    setError(null);
    startTransition(async () => {
      const r = await findOrphanCreatomateRendersAction();
      if (r.ok) {
        setOrphans(r.items);
        setBrands(r.brands);
      } else {
        setError(r.error);
      }
    });
  }

  function recoverAll() {
    setError(null);
    setReport(null);
    startTransition(async () => {
      const r = await recoverAllOrphansAction();
      if (r.ok) {
        setReport({ recovered: r.recovered, failed: r.failed, details: r.details });
        const after = await findOrphanCreatomateRendersAction();
        if (after.ok) {
          setOrphans(after.items);
          setBrands(after.brands);
        }
      } else {
        setError(r.error);
      }
    });
  }

  function recoverOne(orphan: OrphanRow) {
    const brandId = manualBrand[orphan.externalId];
    if (!brandId) {
      setManualResult({
        ...manualResult,
        [orphan.externalId]: "Seleziona prima un marchio dal menù.",
      });
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await recoverOrphanWithBrandAction({
        externalId: orphan.externalId,
        brandId,
        ...(orphan.draftId ? { draftId: orphan.draftId } : {}),
      });
      setManualResult({
        ...manualResult,
        [orphan.externalId]: r.ok ? `✓ ${r.status}` : `✗ ${r.error}`,
      });
      if (r.ok) {
        const after = await findOrphanCreatomateRendersAction();
        if (after.ok) {
          setOrphans(after.items);
          setBrands(after.brands);
        }
      }
    });
  }

  const unresolved = (orphans ?? []).filter((o) => !o.brandId);
  const resolvable = (orphans ?? []).filter((o) => !!o.brandId);

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Render Creatomate orfani</h3>
          <p className="text-[11px] text-text-muted">
            Render partiti su Creatomate (credito già consumato) ma non salvati in Regìa. Il sistema
            prova a ricavare il marchio da: (1) audit event, (2) metadata di Creatomate, (3) scelta
            manuale. I primi due casi sono automatici.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={scan}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-xs hover:border-primary/40 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" /> Scansiona
          </button>
          {resolvable.length > 0 && (
            <button
              type="button"
              onClick={recoverAll}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wrench className="h-3.5 w-3.5" />
              )}
              Recupera auto ({resolvable.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {orphans === null && !error && (
        <div className="text-xs text-text-muted">
          <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Scansione in corso…
        </div>
      )}

      {orphans !== null && orphans.length === 0 && !report && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          <Check className="inline h-3.5 w-3.5" /> Nessun render orfano. Tutto allineato.
        </div>
      )}

      {resolvable.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Recuperabili automaticamente ({resolvable.length})
          </div>
          <ul className="divide-y divide-border rounded-md border border-border bg-bg">
            {resolvable.map((o) => (
              <li key={o.externalId} className="flex items-start justify-between gap-2 p-2 text-xs">
                <div className="min-w-0 flex-1">
                  <code className="font-mono text-[11px]">{o.externalId}</code>
                  <div className="text-[10px] text-text-muted">
                    {o.action} · {new Date(o.startedAt).toLocaleString("it-IT")}
                    {o.draftId && " · bozza collegata"} · brand da{" "}
                    {o.brandSource === "audit" ? "audit" : "metadata Creatomate"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unresolved.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Serve scelta manuale del marchio ({unresolved.length})
          </div>
          {brands.length === 0 ? (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Nessun marchio attivo nell&apos;organizzazione: crea prima un marchio in /marchi.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-bg">
              {unresolved.map((o) => (
                <li key={o.externalId} className="space-y-1.5 p-2 text-xs">
                  <div>
                    <code className="font-mono text-[11px]">{o.externalId}</code>
                    <div className="text-[10px] text-text-muted">
                      {o.action} · {new Date(o.startedAt).toLocaleString("it-IT")}
                      {o.draftId && " · bozza collegata"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={manualBrand[o.externalId] ?? ""}
                      onChange={(e) =>
                        setManualBrand({ ...manualBrand, [o.externalId]: e.target.value })
                      }
                      disabled={pending}
                      className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
                    >
                      <option value="">— scegli marchio —</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.displayName} ({b.slug})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => recoverOne(o)}
                      disabled={pending || !manualBrand[o.externalId]}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                      <Wrench className="h-3 w-3" /> Recupera
                    </button>
                    {manualResult[o.externalId] && (
                      <span
                        className={
                          manualResult[o.externalId]?.startsWith("✓")
                            ? "text-[10px] text-success"
                            : "text-[10px] text-danger"
                        }
                      >
                        {manualResult[o.externalId]}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <div className="font-medium text-primary">
            Recovery completato: ✓ {report.recovered} recuperati
            {report.failed > 0 && `, ✗ ${report.failed} falliti`}
          </div>
          {report.details.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border bg-bg text-[11px]">
              {report.details.map((d, i) => (
                <li key={i} className="p-2">
                  <code className="font-mono">{d.externalId.slice(0, 8)}…</code>:{" "}
                  <span className="text-text-muted">{d.result}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-text-muted">
            <AlertCircle className="inline h-3 w-3" /> Gli asset recuperati con stato
            &quot;succeeded&quot; sono stati salvati nella Libreria media del marchio e allegati
            alla bozza originale (se c&apos;era).
          </p>
        </div>
      )}
    </div>
  );
}
