"use client";

// Banner dashboard che elenca le ricorrenze annuali "in finestra" (RF-3.4).
// Ogni card mostra: nome evento, marchio (chip colorato), giorni rimanenti,
// bottone "Genera bozza". Se gia attivato, badge "Bozza creata".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Sparkles, Check } from "lucide-react";
import type { UpcomingRecurrence } from "@/modules/m03-editorial/public";
import { generateRecurrenceDraft } from "@/modules/m03-editorial/public";

function formatOccurrence(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function RecurrencesBanner({ items }: { items: UpcomingRecurrence[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  function handleGenerate(item: UpcomingRecurrence) {
    setBusyId(item.id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateRecurrenceDraft(item.id, item.yearTag);
        if (result.ok) {
          router.push(`/contenuti/${result.brandSlug}/${result.draftId}`);
        } else {
          setError(result.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore generazione");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-warning" />
        <h2 className="text-lg font-bold text-text" style={{ fontFamily: "var(--font-bricolage)" }}>
          Ricorrenze in arrivo
        </h2>
        <span className="text-xs text-text-muted">({items.length})</span>
      </div>
      <p className="mb-4 text-xs text-text-muted">
        Eventi annuali entro il loro preavviso. Genera una bozza in un click, la potrai poi
        programmare per il giorno esatto.
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((item) => {
          const isBusy = busyId === item.id;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.brandColor }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-text-muted">
                    {item.brandDisplayName}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted/70">
                    {item.kind === "holiday"
                      ? "festivita"
                      : item.kind === "seasonal"
                        ? "stagionale"
                        : "business"}
                  </span>
                </div>
                <div className="mt-0.5 text-sm font-medium text-text">{item.name}</div>
                <div className="text-[11px] text-text-muted">
                  {formatOccurrence(item.occurrenceDateIso)} · tra {item.daysUntil} giorn
                  {item.daysUntil === 1 ? "o" : "i"}
                </div>
              </div>
              <div className="shrink-0">
                {item.alreadyDrafted ? (
                  <Link
                    href={`/contenuti/${item.brandSlug}`}
                    className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/20"
                  >
                    <Check className="h-3.5 w-3.5" /> bozza creata
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGenerate(item)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isBusy ? "Genero..." : "Genera bozza"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
