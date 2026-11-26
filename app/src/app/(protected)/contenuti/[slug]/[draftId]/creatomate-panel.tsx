"use client";

// Pannello "Crea visual" (Creatomate) nel dettaglio bozza.
// Funziona ANCHE SENZA template preregistrati: offre 3 default inline
// (post quadrato, story/reel video, locandina A4) composti dal brand kit +
// bozza. Se il brand ha template Creatomate registrati nella sezione
// marchio, compaiono in lista come alternativa.
//
// Flusso:
//  1) scelgo un formato (default inline) o un template registrato
//  2) il prompt è già precompilato da titolo + testo bozza
//  3) click "Avvia render" → POST /api/creatomate/renders → riga queued
//  4) polling ogni 5s su /api/creatomate/renders/:id finché succeeded/failed
//  5) quando succeeded, la bozza riceve l'asset allegato: router.refresh()

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Loader2, Check, X, AlertCircle } from "lucide-react";
import type { BrandCreatomateTemplate, DefaultVariant } from "@/modules/m15-creatomate/public";
import { DEFAULT_VARIANT_LABELS } from "@/modules/m15-creatomate/public";
import { splitDraftText } from "@/modules/m15-creatomate/public";

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

// L'utente può scegliere fra "default:<variant>" (template inline generato
// da noi) o "custom:<templateId>" (template registrato dal pannello
// Creatomate). Il value del select codifica entrambi.
type SelectedKind = { kind: "default"; variant: DefaultVariant } | { kind: "custom"; templateId: string };

function parseSelected(value: string): SelectedKind | null {
  if (value.startsWith("default:")) {
    const v = value.slice(8) as DefaultVariant;
    if (v === "square_post" || v === "story_reel" || v === "poster_a4") {
      return { kind: "default", variant: v };
    }
  }
  if (value.startsWith("custom:")) {
    return { kind: "custom", templateId: value.slice(7) };
  }
  return null;
}

export function CreatomatePanel({ brandId, draftId, templates, draftContext, onClose }: Props) {
  const router = useRouter();
  // Pre-fill valori dal testo bozza
  const { shortTitle, longBody } = splitDraftText(
    draftContext.generatedText,
    draftContext.themeInput,
  );
  const [title, setTitle] = useState(shortTitle);
  const [body, setBody] = useState(longBody);
  const [ctaText, setCtaText] = useState("Scopri di più");
  const [selected, setSelected] = useState<string>("default:square_post");
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const parsed = parseSelected(selected);
    if (!parsed) {
      setError("Scegli un formato.");
      return;
    }
    startTransition(async () => {
      try {
        let endpoint = "/api/creatomate/renders";
        let payload: Record<string, unknown>;
        if (parsed.kind === "default") {
          endpoint = "/api/creatomate/renders/default";
          payload = {
            brandId,
            draftId,
            variant: parsed.variant,
            shortTitle: title.trim(),
            body: body.trim(),
            ctaText: ctaText.trim() || undefined,
          };
        } else {
          payload = {
            brandId,
            draftId,
            templateId: parsed.templateId,
            modifications: {
              title: title.trim(),
              body: body.trim(),
              cta: ctaText.trim(),
            },
            quality: "final",
          };
        }
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
            Formato
          </span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending || !!renderId}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            <optgroup label="Default (nessuna configurazione)">
              <option value="default:square_post">
                {DEFAULT_VARIANT_LABELS.square_post} · ~1 credito
              </option>
              <option value="default:story_reel">
                {DEFAULT_VARIANT_LABELS.story_reel} · ~3 crediti
              </option>
              <option value="default:poster_a4">
                {DEFAULT_VARIANT_LABELS.poster_a4} · ~1 credito
              </option>
            </optgroup>
            {templates.length > 0 && (
              <optgroup label="Template del marchio">
                {templates.map((t) => (
                  <option key={t.id} value={`custom:${t.templateId}`}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {templates.length === 0 && (
            <p className="mt-1 text-[11px] text-text-muted">
              Puoi anche aggiungere template personalizzati in <strong>Marchio → Template
              Creatomate</strong>.
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Titolo (visibile grande)
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending || !!renderId}
            maxLength={120}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Testo
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={pending || !!renderId}
            rows={3}
            maxLength={400}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Call to action (per story/reel)
          </span>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            disabled={pending || !!renderId}
            maxLength={40}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </label>

        {!renderId && (
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
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
