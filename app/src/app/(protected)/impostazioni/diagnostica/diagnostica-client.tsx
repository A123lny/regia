"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, X as XIcon, PlayCircle } from "lucide-react";
import {
  testGeminiAction,
  testFalAction,
  testCreatomateAction,
  testStorageAction,
  testTemplateRenderAction,
} from "./diagnostica-actions";

type TestKey = "gemini" | "fal" | "creatomate" | "storage" | "template";
type TestOutcome = { ok: boolean; message: string } | null;

const TESTS: Array<{
  key: TestKey;
  label: string;
  hint: string;
  action: () => Promise<{ ok: boolean; message: string }>;
}> = [
  {
    key: "gemini",
    label: "Gemini (generazione testi)",
    hint: "GET /v1beta/models con GEMINI_API_KEY. Zero costo.",
    action: testGeminiAction,
  },
  {
    key: "fal",
    label: "fal.ai (immagini + video)",
    hint: "OPTIONS su /fal-ai/flux/schnell con FAL_KEY. Zero costo.",
    action: testFalAction,
  },
  {
    key: "creatomate",
    label: "Creatomate (grafiche e video da template)",
    hint: "GET /v2/templates?limit=1. Zero credito.",
    action: testCreatomateAction,
  },
  {
    key: "storage",
    label: "Supabase Storage (bucket content-media)",
    hint: "Upload+delete di 2 byte in content-media. Verifica policy.",
    action: testStorageAction,
  },
  {
    key: "template",
    label: "Rendering template (satori + resvg)",
    hint: "Render PNG di 'promo-announce' con dati dummy. Nessuna API esterna.",
    action: testTemplateRenderAction,
  },
];

export function DiagnosticaClient() {
  const [results, setResults] = useState<Record<TestKey, TestOutcome>>({
    gemini: null,
    fal: null,
    creatomate: null,
    storage: null,
    template: null,
  });
  const [running, setRunning] = useState<Set<TestKey>>(new Set());
  const [pending, startTransition] = useTransition();

  function runOne(key: TestKey) {
    const def = TESTS.find((t) => t.key === key);
    if (!def) return;
    setRunning((prev) => new Set(prev).add(key));
    startTransition(async () => {
      try {
        const r = await def.action();
        setResults((prev) => ({ ...prev, [key]: r }));
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [key]: {
            ok: false,
            message: err instanceof Error ? err.message : "Errore sconosciuto.",
          },
        }));
      } finally {
        setRunning((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    });
  }

  function runAll() {
    TESTS.forEach((t) => runOne(t.key));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={runAll}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          Testa tutto
        </button>
      </div>

      <div className="space-y-2">
        {TESTS.map((t) => {
          const r = results[t.key];
          const isRunning = running.has(t.key);
          return (
            <div key={t.key} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text">{t.label}</div>
                  <div className="text-[11px] text-text-muted">{t.hint}</div>
                </div>
                <button
                  type="button"
                  onClick={() => runOne(t.key)}
                  disabled={isRunning || pending}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-xs font-medium hover:border-primary/40 disabled:opacity-50"
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5" />
                  )}
                  Testa
                </button>
              </div>

              {r && (
                <div
                  className={`mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                    r.ok
                      ? "border border-success/30 bg-success/10 text-success"
                      : "border border-danger/30 bg-danger/10 text-danger"
                  }`}
                >
                  {r.ok ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="break-words">{r.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted">
        I test fanno chiamate reali ai servizi ma a basso costo (lista modelli, head request,
        upload/delete di pochi byte). Nessun credito AI o Creatomate viene consumato.
      </p>
    </div>
  );
}
