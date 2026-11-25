"use client";

// Sezione "Template Creatomate" nella pagina di un marchio.
// Owner-only (gate dal server via capability). Lista mappatura template
// (label leggibile ↔ template_id Creatomate) con add/remove.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Plus, Trash2, Loader2 } from "lucide-react";
import type { BrandCreatomateTemplate } from "@/modules/m15-creatomate/public";
import {
  upsertBrandTemplateAction,
  removeBrandTemplateAction,
} from "@/modules/m15-creatomate/public";

type Props = {
  brandId: string;
  brandSlug: string;
  templates: BrandCreatomateTemplate[];
};

export function CreatomateTemplatesSection({ brandId, brandSlug, templates }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(templates.length === 0);
  const [templateId, setTemplateId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTemplateId("");
    setLabel("");
    setDescription("");
    setError(null);
  }

  function add() {
    setError(null);
    startTransition(async () => {
      const r = await upsertBrandTemplateAction({
        brandId,
        templateId: templateId.trim(),
        label: label.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      if (r.ok) {
        reset();
        setShowForm(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function remove(rowId: string) {
    setError(null);
    startTransition(async () => {
      const r = await removeBrandTemplateAction(rowId, brandSlug);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-5">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-xl text-text">
          <Clapperboard className="h-5 w-5 text-primary" /> Template Creatomate
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-xs font-medium hover:border-primary/40"
          >
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </button>
        )}
      </header>
      <p className="text-xs text-text-muted">
        Registra qui i template Creatomate che l&apos;Owner può usare dal dettaglio bozza. L&apos;ID
        template lo prendi dall&apos;URL dell&apos;editor Creatomate (es. <code>abcd-1234</code>).
      </p>

      {templates.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-bg">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-text">{t.label}</div>
                <div className="text-[11px] text-text-muted">
                  id: <code className="rounded bg-surface-muted px-1 py-0.5">{t.templateId}</code>
                </div>
                {t.description && (
                  <div className="mt-1 text-xs text-text-muted">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                disabled={pending}
                className="shrink-0 rounded-md p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
                aria-label="Rimuovi template"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Etichetta (visibile nella bozza)
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Es. Post Instagram 1:1"
              maxLength={80}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
              ID template Creatomate
            </span>
            <input
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="Es. 0f1e2d3c-…"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Note (opzionale)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es. verticale per Story"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={add}
              disabled={pending || !templateId.trim() || !label.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Salva
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                reset();
              }}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
