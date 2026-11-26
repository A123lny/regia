"use client";

// Pannello "Genera video AI" (fal.ai image-to-video).
// Richiede un'immagine allegata alla bozza: la usa come frame iniziale per
// un'animazione video 9:16 di 5s. Job asincrono: polling lato client.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Film, Loader2, X, Check, AlertCircle } from "lucide-react";
import {
  startFalVideoAction,
  getFalVideoJobStatusAction,
} from "@/modules/m04-media/public";

type Props = {
  brandId: string;
  draftId: string;
  hasImage: boolean;
  onClose: () => void;
};

type JobStatus = "queued" | "in_progress" | "succeeded" | "failed";

export function FalVideoPanel({ brandId, draftId, hasImage, onClose }: Props) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const r = await getFalVideoJobStatusAction({ jobId: id });
      if (!r.ok) {
        setError(r.error);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      setStatus(r.status);
      if (r.outputUrl) setOutputUrl(r.outputUrl);
      if (r.status === "succeeded" || r.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (r.status === "failed") {
          setError(r.errorMessage ?? "Render video fallito.");
        } else {
          router.refresh();
        }
      }
    }, 6000);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await startFalVideoAction({
        brandId,
        draftId,
        ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
        durationSeconds: 5,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setJobId(r.jobId);
      setStatus("queued");
      startPolling(r.jobId);
    });
  }

  const inProgress = status === "queued" || status === "in_progress";

  if (!hasImage) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 font-semibold text-warning">
            <Film className="h-4 w-4" /> Genera video AI
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-text-muted">
          Per generare un video serve prima un&apos;immagine allegata alla bozza. Usa
          &quot;Genera con AI&quot;, &quot;Da libreria&quot; o &quot;Crea visual&quot; per averne una, poi torna qui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Film className="h-4 w-4" /> Genera video AI (fal.ai, 5s 9:16)
        </h4>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md p-1 text-text-muted hover:bg-surface disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Prompt animazione (lascia vuoto per usare il testo della bozza)
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={pending || !!jobId}
            rows={2}
            maxLength={2000}
            placeholder="Es. slow pan right, warm sunset light, people walking in background"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs"
          />
        </label>

        {!jobId && (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Avvio…
              </>
            ) : (
              <>
                <Film className="h-4 w-4" /> Genera video (~$0.10)
              </>
            )}
          </button>
        )}

        {jobId && (
          <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-xs">
            <div className="flex items-center gap-2">
              {inProgress && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {status === "succeeded" && <Check className="h-4 w-4 text-success" />}
              {status === "failed" && <AlertCircle className="h-4 w-4 text-danger" />}
              <span className="font-medium">
                {status === "queued" && "In coda…"}
                {status === "in_progress" && "In elaborazione (30-120s)…"}
                {status === "succeeded" && "Pronto"}
                {status === "failed" && "Fallito"}
              </span>
            </div>
            {outputUrl && status === "succeeded" && (
              <video src={outputUrl} controls className="w-full max-w-sm rounded-md" />
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
