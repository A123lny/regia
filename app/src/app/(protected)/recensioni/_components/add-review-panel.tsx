"use client";

// Pannello "Aggiungi recensione" nella pagina /recensioni:
// - inserimento manuale singolo
// - import CSV (author_name, rating, text, posted_at)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Loader2, Check } from "lucide-react";
import { insertManualReviewAction, importReviewsCsvAction } from "@/modules/m08-reviews/public";

type BrandOpt = { id: string; slug: string; displayName: string };

type Props = { brands: BrandOpt[] };

export function AddReviewPanel({ brands }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "manual" | "csv">("closed");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setAuthorName("");
    setRating(5);
    setText("");
    setPostedAt("");
    setCsv("");
    setError(null);
    setSuccess(null);
  }

  function submitManual() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await insertManualReviewAction({
        brandId,
        authorName: authorName.trim(),
        rating,
        text: text.trim(),
        ...(postedAt ? { postedAt: new Date(postedAt).toISOString() } : {}),
      });
      if (r.ok) {
        setSuccess("Recensione aggiunta.");
        reset();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function submitCsv() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await importReviewsCsvAction({ brandId, csv });
      if (r.ok) {
        setSuccess(
          `Importate ${r.imported}, saltate ${r.skipped}.${
            r.errors.length ? " Dettagli errori nel registro attività." : ""
          }`,
        );
        setCsv("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  if (mode === "closed") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary/40"
        >
          <Plus className="h-3.5 w-3.5" /> Aggiungi recensione
        </button>
        <button
          type="button"
          onClick={() => setMode("csv")}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary/40"
        >
          <Upload className="h-3.5 w-3.5" /> Importa CSV
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">
          {mode === "manual" ? "Aggiungi recensione" : "Importa recensioni da CSV"}
        </h3>
        <button
          type="button"
          onClick={() => {
            setMode("closed");
            reset();
          }}
          className="text-xs text-text-muted hover:text-text"
        >
          Chiudi
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Marchio
          </span>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>

        {mode === "manual" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Autore
                </span>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  disabled={pending}
                  maxLength={120}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                  placeholder="Mario Rossi"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Voto (1-5)
                </span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  disabled={pending}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} {"★".repeat(n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Testo
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={pending}
                rows={4}
                maxLength={4000}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Data (opzionale)
              </span>
              <input
                type="date"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={submitManual}
              disabled={pending || !authorName.trim() || !text.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Aggiungi
            </button>
          </>
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                CSV (header: author_name, rating, text, posted_at)
              </span>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                disabled={pending}
                rows={8}
                maxLength={100_000}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs"
                placeholder={
                  "author_name,rating,text,posted_at\nMario Rossi,5,Ottimo locale,2026-11-20\nLuca Bianchi,2,Servizio lento,"
                }
              />
            </label>
            <button
              type="button"
              onClick={submitCsv}
              disabled={pending || !csv.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importa
            </button>
          </>
        )}

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
