"use client";

// Pannello "Genera con AI" per il dettaglio bozza.
// Flusso:
//  1) utente conferma/edita il prompt (precompilato lato server) e sceglie formato
//  2) click "Genera anteprime" → server action generateAiPreviews → 2-4 thumbnails
//  3) click su una variante → "Usa questa" → generateAndSaveAiVariant → asset
//     salvato nel bucket e allegato alla bozza. Il pannello si chiude e la pagina
//     si ricarica tramite router.refresh().
//
// Gli errori (kill switch, budget, provider non attivo, timeout, rifiuto) vengono
// dal server in italiano e si mostrano inline nel pannello.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X, Check } from "lucide-react";
import {
  generateAiPreviews,
  generateAndSaveAiVariant,
  FAL_SIZE_BY_CHANNEL,
  type AiPreviewItem,
  type DraftChannelHint,
} from "@/modules/m04-media/public";

type Props = {
  draftId: string;
  // Prompt iniziale pre-composto server-side (facoltativo: se non passato,
  // la prima chiamata a generateAiPreviews lo calcola da brand + draft).
  initialPrompt?: string;
  onClose: () => void;
};

const CHANNEL_OPTIONS: Array<{ value: DraftChannelHint; label: string }> = [
  { value: "instagram_post", label: FAL_SIZE_BY_CHANNEL.instagram_post.label },
  { value: "instagram_story", label: FAL_SIZE_BY_CHANNEL.instagram_story.label },
  { value: "facebook_link", label: FAL_SIZE_BY_CHANNEL.facebook_link.label },
];

export function AiGeneratePanel({ draftId, initialPrompt, onClose }: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<DraftChannelHint>("instagram_post");
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [previews, setPreviews] = useState<AiPreviewItem[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingFinal, setSavingFinal] = useState(false);

  function runPreviews() {
    setError(null);
    setPreviews(null);
    setSelectedIdx(null);
    startTransition(async () => {
      const r = await generateAiPreviews({ draftId, channel });
      if (r.ok) {
        setPreviews(r.items);
        setPrompt(r.prompt);
        setCost(r.costUsd);
      } else {
        setError(r.error);
      }
    });
  }

  function saveSelected() {
    if (selectedIdx === null || !previews) return;
    setError(null);
    setSavingFinal(true);
    startTransition(async () => {
      const r = await generateAndSaveAiVariant({
        draftId,
        prompt: prompt.trim(),
        channel,
      });
      setSavingFinal(false);
      if (r.ok) {
        onClose();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Genera con AI (fal.ai)
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
            value={channel}
            onChange={(e) => setChannel(e.target.value as DraftChannelHint)}
            disabled={pending}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Prompt (modificabile prima di rigenerare)
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="Scrivi o lascia vuoto: 'Genera anteprime' lo pre-compila dal testo della bozza e dal brand kit."
            maxLength={2000}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runPreviews}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending && !savingFinal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Genero anteprime…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Genera anteprime
              </>
            )}
          </button>
          {cost !== null && (
            <span className="text-xs text-text-muted">Ultima spesa: ${cost.toFixed(4)}</span>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </div>
        )}

        {previews && previews.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              Clicca una variante, poi &quot;Usa questa&quot;.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {previews.map((p, i) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  disabled={pending}
                  className={`relative overflow-hidden rounded-md border-2 transition-all disabled:opacity-50 ${
                    selectedIdx === i
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Variante ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  {selectedIdx === i && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <Check className="h-8 w-8 text-white drop-shadow" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveSelected}
                disabled={selectedIdx === null || pending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {savingFinal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvo in libreria…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Usa questa (qualità alta)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
