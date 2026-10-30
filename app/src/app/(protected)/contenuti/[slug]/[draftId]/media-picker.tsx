"use client";

// Selettore immagine per un draft (RF-4.1 + RF-4.2).
// Due modalita: libreria esistente o generazione da template.
// Modal per libreria + modal per template picker + form campi template.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ImageIcon,
  X,
  Check,
  Loader2,
  Sparkles,
  LayoutTemplate,
  Download,
  Wand2,
} from "lucide-react";
import type { MediaAsset, TemplateDefinition } from "@/modules/m04-media/public";
import {
  attachMediaAssetToDraft,
  detachMediaAssetFromDraft,
  generateFromTemplate,
  suggestTemplateForDraft,
  autofillTemplateFields,
} from "@/modules/m04-media/public";

type DraftContext = {
  topicLabel: string | null;
  generatedText: string;
};

type Props = {
  draftId: string;
  brandSlug: string;
  currentAsset: MediaAsset | null;
  availableAssets: MediaAsset[];
  availableTemplates: TemplateDefinition[];
  /** RF-4.2 draft context per suggest + autofill template (opzionale per retro-compat). */
  draftContext?: DraftContext;
};

type PickerMode = "library" | "template";

export function DraftMediaPicker({
  draftId,
  brandSlug,
  currentAsset,
  availableAssets,
  availableTemplates,
  draftContext,
}: Props) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState<PickerMode | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // RF-4.2: template suggerito deterministicamente dal topic del draft.
  const suggestedTemplate = draftContext
    ? suggestTemplateForDraft(draftContext, availableTemplates)
    : null;

  function handleAutofillFromDraft() {
    if (!selectedTemplate || !draftContext) return;
    setTemplateFields(autofillTemplateFields(draftContext, selectedTemplate));
  }

  function handleAttach(assetId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await attachMediaAssetToDraft(draftId, assetId, brandSlug);
        setPickerOpen(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  function handleTemplatePick(t: TemplateDefinition) {
    setSelectedTemplate(t);
    const init: Record<string, string> = {};
    for (const f of t.fields) init[f.key] = "";
    setTemplateFields(init);
  }

  function handleGenerateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setError(null);
    startTransition(async () => {
      try {
        await generateFromTemplate({
          draftId,
          brandSlug,
          templateId: selectedTemplate.id,
          fields: templateFields,
        });
        setPickerOpen(null);
        setSelectedTemplate(null);
        setTemplateFields({});
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore generazione");
      }
    });
  }

  function handleDetach() {
    if (!confirm("Staccare l'immagine dal contenuto?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await detachMediaAssetFromDraft(draftId, brandSlug);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Immagine allegata</h3>
        {currentAsset ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen("library")}
              disabled={busy}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:border-primary/40 disabled:opacity-50"
            >
              Sostituisci
            </button>
            <button
              type="button"
              onClick={handleDetach}
              disabled={busy}
              className="rounded-md p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
              aria-label="Stacca immagine"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen("library")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:border-primary/40 disabled:opacity-50"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Da libreria
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen("template")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <LayoutTemplate className="h-3.5 w-3.5" /> Da template
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
          {error}
        </div>
      )}

      {currentAsset ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentAsset.signedUrl}
            alt={currentAsset.caption || "immagine allegata"}
            className="h-32 w-32 rounded-md border border-border object-cover"
          />
          <div className="flex-1 text-xs text-text-muted">
            <div className="font-medium text-text">{currentAsset.caption || "senza caption"}</div>
            {currentAsset.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {currentAsset.tags.map((t) => (
                  <span key={t} className="rounded-full bg-surface-muted px-1.5 py-0 text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <a
              href={currentAsset.signedUrl}
              download={`${(currentAsset.caption || "media").replace(/[^a-z0-9-]+/gi, "-").slice(0, 40)}.${
                currentAsset.contentType === "image/png"
                  ? "png"
                  : currentAsset.contentType === "image/webp"
                    ? "webp"
                    : currentAsset.contentType === "image/svg+xml"
                      ? "svg"
                      : "jpg"
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text hover:border-primary/40"
            >
              <Download className="h-3 w-3" /> Scarica HR
            </a>
          </div>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Nessuna immagine. Sceglila dalla libreria del marchio (o carica prima nella libreria).
        </p>
      )}

      {/* Modal picker LIBRERIA */}
      {pickerOpen === "library" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPickerOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2
                className="text-lg font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                Scegli immagine dalla libreria
              </h2>
              <button
                type="button"
                onClick={() => setPickerOpen(null)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {availableAssets.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-muted">
                  Nessuna immagine in libreria. Caricala prima da{" "}
                  <a href={`/marchi/${brandSlug}/media`} className="underline hover:text-primary">
                    Libreria media
                  </a>
                  .
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {availableAssets.map((a) => {
                    const isCurrent = currentAsset?.id === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => !isCurrent && handleAttach(a.id)}
                        disabled={busy || isCurrent}
                        className={`group relative overflow-hidden rounded-lg border-2 transition-colors ${
                          isCurrent ? "border-success" : "border-border hover:border-primary"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.signedUrl}
                          alt={a.caption || "media"}
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                        />
                        {isCurrent && (
                          <div className="absolute inset-0 flex items-center justify-center bg-success/40">
                            <div className="rounded-full bg-success p-1.5 text-white">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                        {busy && !isCurrent && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                        <div className="border-t border-border bg-surface p-1.5">
                          <div className="truncate text-[10px] text-text">
                            {a.caption || (
                              <span className="italic text-text-muted">no caption</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal picker TEMPLATE */}
      {pickerOpen === "template" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setPickerOpen(null);
            setSelectedTemplate(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2
                className="flex items-center gap-2 text-lg font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                <LayoutTemplate className="h-5 w-5 text-primary" />
                {selectedTemplate ? `Compila: ${selectedTemplate.name}` : "Scegli template"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(null);
                  setSelectedTemplate(null);
                }}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {!selectedTemplate ? (
                availableTemplates.length === 0 ? (
                  <p className="p-6 text-center text-sm text-text-muted">
                    Nessun template disponibile per questo marchio.
                  </p>
                ) : (
                  <>
                    {suggestedTemplate && (
                      <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-start gap-2">
                          <Wand2 className="mt-0.5 h-4 w-4 text-primary" />
                          <div className="flex-1 text-xs">
                            <div className="font-medium text-text">
                              Suggerito: {suggestedTemplate.name} (RF-4.2)
                            </div>
                            <p className="mt-0.5 text-text-muted">
                              Scelto automaticamente dal topic del draft. Puoi comunque scegliere un
                              altro template dalla lista.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                handleTemplatePick(suggestedTemplate);
                                if (draftContext) {
                                  setTemplateFields(
                                    autofillTemplateFields(draftContext, suggestedTemplate),
                                  );
                                }
                              }}
                              className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                            >
                              <Wand2 className="h-3 w-3" />
                              Usa suggerito + compila dal draft
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {availableTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleTemplatePick(t)}
                          className={`rounded-lg border p-3 text-left hover:border-primary/50 ${
                            t.id === suggestedTemplate?.id
                              ? "border-primary/60 bg-primary/5"
                              : "border-border bg-surface"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-text">{t.name}</span>
                            {t.id === suggestedTemplate?.id && (
                              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                                Suggerito
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-text-muted">{t.description}</div>
                          <div className="mt-1 text-[10px] text-text-muted/70">
                            {t.fields.length} campi · formato {t.format}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )
              ) : (
                <form onSubmit={handleGenerateTemplate} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(null)}
                      className="text-xs text-text-muted underline hover:text-primary"
                    >
                      ← scegli altro template
                    </button>
                    {draftContext && (
                      <button
                        type="button"
                        onClick={handleAutofillFromDraft}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        <Wand2 className="h-3 w-3" />
                        Compila dal draft
                      </button>
                    )}
                  </div>
                  {selectedTemplate.fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-xs font-medium text-text">
                        {f.label}
                        {f.required && <span className="ml-1 text-danger">*</span>}
                      </span>
                      {f.multiline ? (
                        <textarea
                          value={templateFields[f.key] ?? ""}
                          onChange={(e) =>
                            setTemplateFields({ ...templateFields, [f.key]: e.target.value })
                          }
                          required={f.required}
                          maxLength={f.maxLength ?? 500}
                          rows={3}
                          placeholder={f.placeholder}
                          className="mt-0.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={templateFields[f.key] ?? ""}
                          onChange={(e) =>
                            setTemplateFields({ ...templateFields, [f.key]: e.target.value })
                          }
                          required={f.required}
                          maxLength={f.maxLength ?? 200}
                          placeholder={f.placeholder}
                          className="mt-0.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                        />
                      )}
                    </label>
                  ))}
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <p className="text-[11px] text-text-muted">
                      La generazione richiede ~2-3 secondi.
                    </p>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Genera immagine
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
