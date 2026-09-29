"use client";

// Banner dashboard: richieste materiali (foto/video) aperte (RF-3.9).
// Ogni riga: brand + descrizione + scadenza + azioni fulfill/cancel.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, X as XIcon, Loader2 } from "lucide-react";
import type { MaterialRequest } from "@/modules/m03-editorial/public";
import { fulfillMaterialRequest, cancelMaterialRequest } from "@/modules/m03-editorial/public";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function MaterialRequestsBanner({ items }: { items: MaterialRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  function handleFulfill(id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await fulfillMaterialRequest(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleCancel(id: string) {
    if (!confirm("Annullare la richiesta materiale?")) return;
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await cancelMaterialRequest(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Camera className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-text" style={{ fontFamily: "var(--font-bricolage)" }}>
          Materiali da raccogliere
        </h2>
        <span className="text-xs text-text-muted">({items.length})</span>
      </div>
      <p className="mb-4 text-xs text-text-muted">
        Foto o video che servono per contenuti in preparazione. Marca come &ldquo;raccolti&rdquo;
        quando la foto e in libreria (M4 arrivera presto: per ora conferma manualmente).
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {items.map((r) => {
          const dLeft = daysUntil(r.neededByDate);
          const isUrgent = dLeft !== null && dLeft <= 2;
          const isOverdue = dLeft !== null && dLeft < 0;
          const isBusy = busyId === r.id;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: r.brandColor }}
                      aria-hidden="true"
                    />
                    {r.brandDisplayName}
                  </span>
                  {r.assignedTo && (
                    <span className="text-[10px] text-text-muted">→ {r.assignedTo}</span>
                  )}
                  {r.neededByDate && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isOverdue
                          ? "border border-danger/30 bg-danger/10 text-danger"
                          : isUrgent
                            ? "border border-warning/30 bg-warning/10 text-warning"
                            : "border border-border bg-surface-muted text-text-muted"
                      }`}
                    >
                      entro {formatDate(r.neededByDate)}
                      {dLeft !== null && (
                        <span>({isOverdue ? `-${Math.abs(dLeft)}` : `+${dLeft}`}gg)</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-text">{r.description}</p>
                <Link
                  href={`/contenuti/${r.brandSlug}/${r.draftId}`}
                  className="mt-0.5 inline-block text-[11px] text-text-muted underline hover:text-primary"
                >
                  bozza: {r.draftThemeInput.slice(0, 60)}
                  {r.draftThemeInput.length > 60 ? "…" : ""}
                </Link>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleFulfill(r.id)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  title="Segna come raccolto"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Raccolto
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  disabled={isBusy}
                  className="rounded-md p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                  aria-label="Annulla richiesta"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
