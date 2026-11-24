"use client";

// Campo unico "Crea un post" sulla Home.
// - Il marchio di default proviene dal selettore globale (prop currentBrand).
//   Se non è attivo nessun filtro (="tutti i marchi"), il select mostra
//   "Scegli il marchio" e Genera resta disabilitato.
// - L'AI classifica il testo e chiama generateSocialPost o
//   generateServiceCommunication (vedi create-post-action.ts). Alla risposta:
//   success → push al draft creato; errore → messaggio INLINE, il testo resta.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { startNewPostAction } from "./create-post-action";

type BrandOpt = { slug: string; displayName: string };

export function CreatePostField({
  brands,
  currentBrand,
}: {
  brands: BrandOpt[];
  currentBrand: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  // Marchio di default: quello del selettore globale se presente e valido,
  // altrimenti "" → l'utente deve sceglierlo.
  const defaultBrand =
    currentBrand && brands.some((b) => b.slug === currentBrand) ? currentBrand : "";
  const [brandSlug, setBrandSlug] = useState(defaultBrand);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed || !brandSlug) return;
    startTransition(async () => {
      const result = await startNewPostAction({ brandSlug, text: trimmed });
      if (result.ok) {
        router.push(`/contenuti/${result.brandSlug}/${result.draftId}`);
      } else {
        setError(result.error);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-text-muted">
        Collega almeno un marchio in Impostazioni → Marchi per iniziare a generare post.
      </div>
    );
  }

  const canSubmit = text.trim().length > 0 && brandSlug.length > 0 && !pending;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <label htmlFor="create-post-text" className="mb-2 block text-sm font-semibold text-text">
        Crea un post
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        <select
          value={brandSlug}
          onChange={(e) => setBrandSlug(e.target.value)}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
          aria-label="Marchio"
        >
          <option value="">Scegli il marchio…</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.displayName}
            </option>
          ))}
        </select>
        <textarea
          id="create-post-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Es. 'Da lunedì consegniamo anche a pranzo' oppure 'Chiuso 30 novembre per inventario'."
          rows={2}
          maxLength={2000}
          disabled={pending}
          className="min-h-[44px] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "Genero…" : "Genera"}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </div>
      )}
      <p className="mt-2 text-xs text-text-muted">
        L&apos;AI capisce da sola se è un avviso di servizio o un post promozionale. Resta da
        approvare prima della pubblicazione.
      </p>
    </div>
  );
}
