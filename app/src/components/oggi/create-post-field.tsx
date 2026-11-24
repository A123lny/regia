"use client";

// Campo unico "Crea un post": textarea che apre la generazione per il brand
// selezionato (o il primo disponibile). L'AI decide se il testo e' un avviso
// di servizio o un post normale (prompt della Corsia veloce incluso).
//
// Il testo NON viaggia in query string: va via server action che imposta
// un cookie HttpOnly short-lived (60s, path /contenuti/<slug>/nuovo).

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { startNewPostAction } from "./create-post-action";

type BrandOpt = { slug: string; displayName: string };

export function CreatePostField({ brands }: { brands: BrandOpt[] }) {
  const [text, setText] = useState("");
  const [brandSlug, setBrandSlug] = useState(brands[0]?.slug ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || !brandSlug) return;
    startTransition(async () => {
      await startNewPostAction({ brandSlug, text: trimmed });
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

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <label
        htmlFor="create-post-text"
        className="mb-2 block text-sm font-semibold text-text"
      >
        Crea un post
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        <select
          value={brandSlug}
          onChange={(e) => setBrandSlug(e.target.value)}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
          aria-label="Marchio"
        >
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
          className="min-h-[44px] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || pending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "Apro..." : "Genera"}
        </button>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        L&apos;AI capisce da sola se è un avviso di servizio o un post promozionale. Resta da
        approvare prima della pubblicazione.
      </p>
    </div>
  );
}
