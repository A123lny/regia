"use client";

// Card "Addestra stile" — LoRA training su fal.
// Flusso:
//  1. Utente apre il picker, seleziona 4-30 immagini dalla Libreria.
//  2. Click "Avvia training": chiama startLoraTrainingAction, resta sulla pagina.
//  3. Il job appare in "Training recenti" con stato queued → in_progress → succeeded/failed.
//  4. Polling automatico ogni 20s per il job più recente non-terminato.
//  5. A training completato, brand_kits.lora_model_url si popola automaticamente.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2, Check, AlertCircle, X, Trash2 } from "lucide-react";
import type { MediaAsset, LoraJob } from "@/modules/m04-media/public";
import {
  startLoraTrainingAction,
  getLoraTrainingJobStatusAction,
  clearBrandLoraAction,
} from "@/modules/m04-media/public";

type Props = {
  brandId: string;
  brandSlug: string;
  loraModelUrl: string | null;
  assets: MediaAsset[];
  initialJobs: LoraJob[];
};

export function LoraTrainingCard({ brandId, loraModelUrl, assets, initialJobs }: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [triggerWord, setTriggerWord] = useState("");
  const [jobs, setJobs] = useState<LoraJob[]>(initialJobs);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Polling job attivi (queued/in_progress). Il più recente viene polled
  // ogni 20s; la UI aggiorna lo stato quando fal risponde COMPLETED/FAILED.
  useEffect(() => {
    const active = jobs.find((j) => j.status === "queued" || j.status === "in_progress");
    if (!active) return;
    const int = setInterval(async () => {
      const r = await getLoraTrainingJobStatusAction({ jobId: active.id });
      if (r.ok) {
        setJobs((prev) => prev.map((j) => (j.id === r.job.id ? r.job : j)));
        if (r.job.status === "succeeded") router.refresh();
      }
    }, 20_000);
    return () => clearInterval(int);
  }, [jobs, router]);

  function toggleAsset(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function startTraining() {
    setError(null);
    if (selected.size < 4) {
      setError("Seleziona almeno 4 immagini.");
      return;
    }
    if (selected.size > 30) {
      setError("Seleziona al massimo 30 immagini.");
      return;
    }
    startTransition(async () => {
      const r = await startLoraTrainingAction({
        brandId,
        assetIds: Array.from(selected),
        ...(triggerWord.trim() ? { triggerWord: triggerWord.trim() } : {}),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Crea una riga stub nel local state per vedere subito il job.
      const now = new Date().toISOString();
      const stub: LoraJob = {
        id: r.jobId,
        brandId,
        requestId: r.requestId,
        status: "queued",
        loraUrl: null,
        errorMessage: null,
        numImages: selected.size,
        triggerWord: triggerWord.trim() || null,
        createdAt: now,
        succeededAt: null,
        failedAt: null,
      };
      setJobs((prev) => [stub, ...prev]);
      setPickerOpen(false);
      setSelected(new Set());
      setTriggerWord("");
    });
  }

  function clearLora() {
    if (
      !confirm("Rimuovere il LoRA attuale? Le prossime generazioni torneranno al modello base.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await clearBrandLoraAction({ brandId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-text">
            <Wand2 className="h-4 w-4 text-primary" /> Addestra stile (LoRA)
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Addestra un modello di stile personalizzato per il marchio su 4-30 foto della Libreria.
            Costa ~$2 per training, dura ~5-10 minuti. Una volta pronto, le generazioni
            &laquo;Genera con AI&raquo; useranno questo stile.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {loraModelUrl ? (
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1 font-medium text-success">
                <Check className="h-3.5 w-3.5" /> LoRA attivo
              </div>
              <code className="mt-1 block truncate font-mono text-[10px] text-text-muted">
                {loraModelUrl}
              </code>
            </div>
            <button
              type="button"
              onClick={clearLora}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-bg px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> Rimuovi
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
          Nessun LoRA attualmente attivo per questo marchio.
        </div>
      )}

      {!pickerOpen ? (
        <button
          type="button"
          onClick={() => {
            setSelected(new Set());
            setError(null);
            setPickerOpen(true);
          }}
          disabled={pending || assets.length < 4}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          title={
            assets.length < 4
              ? "Servono almeno 4 immagini in Libreria per avviare un training"
              : undefined
          }
        >
          <Wand2 className="h-4 w-4" /> Nuovo addestramento
        </button>
      ) : (
        <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-text">
                Seleziona 4-30 immagini dalla Libreria
              </div>
              <div className="text-[11px] text-text-muted">
                {selected.size} selezionate · consigliate 15-25 foto omogenee di stile
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="rounded-md p-1 text-text-muted hover:bg-surface"
              aria-label="Annulla"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto rounded-md border border-border bg-bg p-2 sm:grid-cols-6">
            {assets.map((a) => {
              const isSel = selected.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAsset(a.id)}
                  className={`group relative overflow-hidden rounded border-2 transition-colors ${
                    isSel ? "border-primary" : "border-border hover:border-primary/40"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.signedUrl}
                    alt={a.caption || "media"}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  {isSel && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/40">
                      <div className="rounded-full bg-primary p-1 text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="text-[11px] font-medium text-text">
              Trigger word (opzionale, a-z0-9, max 30 char)
            </span>
            <input
              type="text"
              value={triggerWord}
              onChange={(e) => setTriggerWord(e.target.value)}
              maxLength={30}
              placeholder="es. lennystyle"
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-1.5 text-xs"
            />
            <span className="mt-0.5 block text-[10px] text-text-muted">
              Se vuota, lo stile si attiva automaticamente senza parola chiave.
            </span>
          </label>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-[11px] text-text-muted">
              Costo stimato <strong>~$2</strong>. Addebitato all&apos;avvio.
            </p>
            <button
              type="button"
              onClick={startTraining}
              disabled={pending || selected.size < 4 || selected.size > 30}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Avvio…
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" /> Avvia training ({selected.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Training recenti
          </div>
          <ul className="divide-y divide-border rounded-md border border-border bg-bg text-xs">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-start justify-between gap-2 p-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {j.status === "queued" && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
                        <span className="text-text-muted">In coda</span>
                      </>
                    )}
                    {j.status === "in_progress" && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-primary">In addestramento</span>
                      </>
                    )}
                    {j.status === "succeeded" && (
                      <>
                        <Check className="h-3 w-3 text-success" />
                        <span className="text-success">Completato</span>
                      </>
                    )}
                    {j.status === "failed" && (
                      <>
                        <AlertCircle className="h-3 w-3 text-danger" />
                        <span className="text-danger">Fallito</span>
                      </>
                    )}
                    <span className="text-[10px] text-text-muted">
                      · {j.numImages} foto
                      {j.triggerWord && ` · trigger "${j.triggerWord}"`}·{" "}
                      {new Date(j.createdAt).toLocaleString("it-IT")}
                    </span>
                  </div>
                  {j.errorMessage && (
                    <div className="mt-0.5 truncate text-[10px] text-danger">{j.errorMessage}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
