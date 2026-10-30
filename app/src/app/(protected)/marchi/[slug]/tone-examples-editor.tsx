"use client";

// RN-70 Editor esempi tono — client component. L'owner incolla fino a 10 post
// passati del marchio con una nota su cosa funzionava. Alimentano il prompt M3.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  MAX_TONE_EXAMPLES,
  TONE_EXAMPLE_TEXT_MAX,
  TONE_EXAMPLE_NOTE_MAX,
  updateBrandKitToneExamples,
  type ToneExample,
} from "@/modules/m02-brand/public";

export function ToneExamplesEditor({
  brandId,
  initialExamples,
}: {
  brandId: string;
  initialExamples: ToneExample[];
}) {
  const router = useRouter();
  const [examples, setExamples] = useState<ToneExample[]>(initialExamples);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateExample(idx: number, patch: Partial<ToneExample>) {
    setExamples((cur) => cur.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function removeExample(idx: number) {
    setExamples((cur) => cur.filter((_, i) => i !== idx));
  }

  function addExample() {
    if (examples.length >= MAX_TONE_EXAMPLES) return;
    setExamples((cur) => [...cur, { text: "", note: "" }]);
  }

  function handleSave() {
    setError(null);
    setSavedMsg(null);
    // Scarta righe completamente vuote prima dell'invio
    const cleaned = examples
      .map((e) => ({ text: e.text.trim(), note: e.note.trim() }))
      .filter((e) => e.text.length > 0);
    startTransition(async () => {
      try {
        await updateBrandKitToneExamples(brandId, cleaned);
        setExamples(cleaned);
        setSavedMsg(`${cleaned.length} esempi salvati.`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore salvataggio");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Incolla fino a {MAX_TONE_EXAMPLES} post passati del marchio con una nota su cosa funzionava
        (le poche visualizzazioni non li rendono inutili: servono per il tono, non per il
        risultato). Verranno iniettati nel prompt AI come esempi di stile.
      </p>

      {examples.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-bg p-6 text-center text-sm italic text-text-muted">
          Nessun esempio ancora. Clicca &ldquo;Aggiungi esempio&rdquo; per iniziare.
        </p>
      )}

      {examples.map((ex, idx) => (
        <div key={idx} className="rounded-md border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text">Esempio {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeExample(idx)}
              disabled={isPending}
              className="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
              aria-label="Rimuovi esempio"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="block">
            <span className="text-[10px] font-medium text-text-muted">
              Testo del post (max {TONE_EXAMPLE_TEXT_MAX})
            </span>
            <textarea
              value={ex.text}
              onChange={(e) => updateExample(idx, { text: e.target.value })}
              rows={3}
              maxLength={TONE_EXAMPLE_TEXT_MAX}
              className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              placeholder="Es: Oggi venerdì sera, pizza napoletana che fa gola..."
            />
            <div className="mt-0.5 text-right text-[10px] text-text-muted">
              {ex.text.length}/{TONE_EXAMPLE_TEXT_MAX}
            </div>
          </label>
          <label className="mt-2 block">
            <span className="text-[10px] font-medium text-text-muted">
              Perché funziona (opzionale, max {TONE_EXAMPLE_NOTE_MAX})
            </span>
            <input
              type="text"
              value={ex.note}
              onChange={(e) => updateExample(idx, { note: e.target.value })}
              maxLength={TONE_EXAMPLE_NOTE_MAX}
              className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              placeholder="Es: tono diretto, finale emotivo"
            />
          </label>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={examples.length >= MAX_TONE_EXAMPLES || isPending}
          onClick={addExample}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Aggiungi esempio
          {examples.length >= MAX_TONE_EXAMPLES && ` (max ${MAX_TONE_EXAMPLES} raggiunto)`}
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-primary text-white hover:bg-primary-hover"
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? "Salvo..." : "Salva esempi"}
        </Button>
        {savedMsg && <span className="text-xs text-success">{savedMsg}</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
