"use client";

// Pannello "Crea visual" (Creatomate) nel dettaglio bozza.
// Flusso:
//  1) scelgo un template fra quelli mappati per il brand
//  2) riempio i modifications (precompilati da titolo/testo bozza)
//  3) scelgo qualità: test (480x480, 1 credito) o finale (dimensioni template, ~3 crediti)
//  4) click "Avvia render" → POST /api/creatomate/renders → riga queued
//  5) polling ogni 5s su /api/creatomate/renders/:id finché succeeded/failed
//  6) quando succeeded, la bozza riceve l'asset allegato: router.refresh()
//
// Fallback senza webhook (dev locale): il polling chiude comunque il flusso.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Loader2, Check, X, AlertCircle } from "lucide-react";
import type { BrandCreatomateTemplate } from "@/modules/m15-creatomate/public";
import { prefillModifications } from "@/modules/m15-creatomate/public";

type DraftContext = {
  themeInput: string;
  generatedText: string;
};

type Props = {
  brandId: string;
  draftId: string;
  templates: BrandCreatomateTemplate[];
  draftContext: DraftContext;
  onClose: () => void;
};

type RenderStatus = "queued" | "planned" | "rendering" | "succeeded" | "failed" | "cancelled";

export function CreatomatePanel({ brandId, draftId, templates, draftContext, onClose }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.templateId ?? "");
  // Chiavi del form modifications: al primo giro offriamo 3 slot generici
  // (title/body/image). Quando l'utente avrà template reali servirebbe un
  // introspection dei placeholder dall'API Creatomate; per ora chiave libera.
  const defaultKeys = ["title", "body", "image"];
  const [modifications, setModifications] = useState<Record<string, string>>(() =>
    prefillModifications(defaultKeys, draftContext),
  );
  const [quality, setQuality] = useState<"test" | "final">("test");
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling se componente smontato
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function startPolling(id: string) {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/creatomate/renders/${id}`, { cache: "no-store" });
        const data = (await res.json()) as {
          ok: boolean;
          status?: RenderStatus;
          outputUrl?: string | null;
          error?: string;
          errorMessage?: string | null;
        };
        if (!data.ok) {
          setError(data.error ?? "Errore nel polling");
          if (pollTimer.current) clearInterval(pollTimer.current);
          return;
        }
        if (data.status) {
          setStatus(data.status);
          if (data.outputUrl) setOutputUrl(data.outputUrl);
        }
        if (
          data.status === "succeeded" ||
          data.status === "failed" ||
          data.status === "cancelled"
        ) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          if (data.status === "failed") {
            setError(data.errorMessage ?? "Render fallito.");
          } else if (data.status === "succeeded") {
            router.refresh();
          }
        }
      } catch (e) {
        console.error("[creatomate panel] polling", e);
      }
    }, 5000);
  }

  function submit() {
    setError(null);
    if (!templateId) {
      setError("Scegli un template.");
      return;
    }
    const mods = Object.fromEntries(
      Object.entries(modifications).filter(([, v]) => v && v.trim().length > 0),
    );
    startTransition(async () => {
      try {
        const res = await fetch("/api/creatomate/renders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            draftId,
            templateId,
            modifications: mods,
            quality,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          renderId?: string;
          externalId?: string;
          status?: string;
          error?: string;
        };
        if (!data.ok || !data.renderId) {
          setError(data.error ?? "Impossibile avviare il render.");
          return;
        }
        setRenderId(data.renderId);
        setStatus((data.status as RenderStatus) ?? "queued");
        startPolling(data.renderId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore di rete.");
      }
    });
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 font-semibold text-warning">
            <Clapperboard className="h-4 w-4" /> Crea visual (Creatomate)
          </h4>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-text-muted">
          Nessun template Creatomate configurato per questo marchio. Vai in{" "}
          <a href={`/marchi/${brandId}`} className="text-primary underline hover:no-underline">
            Marchio → template Creatomate
          </a>{" "}
          e aggiungine almeno uno (serve un template creato nel pannello Creatomate).
        </p>
      </div>
    );
  }

  const inProgress =
    status && status !== "succeeded" && status !== "failed" && status !== "cancelled";

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Clapperboard className="h-4 w-4" /> Crea visual (Creatomate)
        </h4>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md p-1 text-text-muted hover:bg-surface disabled:opacity-50"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Template
          </span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={pending || !!renderId}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.templateId}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 rounded-md border border-border bg-surface p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Campi dinamici
          </p>
          {Object.keys(modifications).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs text-text-muted">{k}</span>
              <input
                type="text"
                value={modifications[k] ?? ""}
                onChange={(e) => setModifications((prev) => ({ ...prev, [k]: e.target.value }))}
                disabled={pending || !!renderId}
                maxLength={500}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs"
              />
            </label>
          ))}
          <p className="text-[10px] text-text-muted">
            I nomi dei campi devono corrispondere ai placeholder definiti nel template Creatomate.
          </p>
        </div>

        <fieldset className="grid grid-cols-2 gap-2" disabled={pending || !!renderId}>
          <label
            className={`cursor-pointer rounded-md border p-2 text-xs ${
              quality === "test"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text"
            }`}
          >
            <input
              type="radio"
              name="quality"
              value="test"
              checked={quality === "test"}
              onChange={() => setQuality("test")}
              className="hidden"
            />
            <div className="font-medium">Test (480×480, 1 credito)</div>
            <div className="text-text-muted">Per verificare testi e composizione.</div>
          </label>
          <label
            className={`cursor-pointer rounded-md border p-2 text-xs ${
              quality === "final"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text"
            }`}
          >
            <input
              type="radio"
              name="quality"
              value="final"
              checked={quality === "final"}
              onChange={() => setQuality("final")}
              className="hidden"
            />
            <div className="font-medium">Finale (~3 crediti)</div>
            <div className="text-text-muted">Dimensioni e durata del template.</div>
          </label>
        </fieldset>

        {!renderId && (
          <button
            type="button"
            onClick={submit}
            disabled={pending || !templateId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Avvio…
              </>
            ) : (
              <>
                <Clapperboard className="h-4 w-4" /> Avvia render
              </>
            )}
          </button>
        )}

        {renderId && (
          <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-xs">
            <div className="flex items-center gap-2">
              {inProgress && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {status === "succeeded" && <Check className="h-4 w-4 text-success" />}
              {status === "failed" && <AlertCircle className="h-4 w-4 text-danger" />}
              <span className="font-medium">
                {status === "queued" && "In coda…"}
                {status === "planned" && "In pianificazione…"}
                {status === "rendering" && "In lavorazione…"}
                {status === "succeeded" && "Completato"}
                {status === "failed" && "Render fallito"}
                {status === "cancelled" && "Annullato"}
              </span>
            </div>
            {outputUrl && status === "succeeded" && (
              <div className="space-y-2">
                {outputUrl.endsWith(".mp4") ? (
                  <video src={outputUrl} controls className="w-full max-w-sm rounded-md" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={outputUrl} alt="render" className="w-full max-w-sm rounded-md" />
                )}
                <a
                  href={outputUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Apri output
                </a>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
