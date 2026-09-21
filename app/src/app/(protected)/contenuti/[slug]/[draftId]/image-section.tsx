"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  suggestImagePrompt,
  generateContentDraftImage,
  deleteContentDraftImage,
} from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";

type Props = {
  draftId: string;
  status: ContentDraftStatus;
  currentImageSignedUrl: string | null;
  currentImagePrompt: string | null;
  currentImageModel: string | null;
  currentImageCost: number | null;
  currentImageGeneratedAt: string | null;
};

type FluxModel = "flux-dev" | "flux-schnell";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImageSection(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(props.currentImagePrompt ?? "");
  const [model, setModel] = useState<FluxModel>(
    (props.currentImageModel as FluxModel | null) ?? "flux-dev",
  );
  const [showPromptForm, setShowPromptForm] = useState<boolean>(false);
  const [editingPrompt, setEditingPrompt] = useState<boolean>(false);

  const isReadonly = props.status === "published" || props.status === "rejected";
  const hasImage = props.currentImageSignedUrl !== null;

  async function handleSuggest() {
    setError(null);
    startTransition(async () => {
      const res = await suggestImagePrompt(props.draftId);
      if (res.ok) {
        setPrompt(res.prompt);
        setShowPromptForm(true);
      } else {
        setError(res.error);
      }
    });
  }

  async function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateContentDraftImage(props.draftId, prompt, model);
      if (res.ok) {
        setShowPromptForm(false);
        setEditingPrompt(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  async function handleDelete() {
    if (!confirm("Confermi? L'immagine sarà cancellata.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteContentDraftImage(props.draftId);
        setPrompt("");
        setShowPromptForm(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <header className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-text">Immagine del post</h3>
        {props.currentImageModel && (
          <div className="flex flex-wrap gap-1 text-xs">
            <Badge variant="outline">Modello: {props.currentImageModel}</Badge>
            {props.currentImageCost !== null && (
              <Badge variant="outline">Costo: ${props.currentImageCost.toFixed(4)}</Badge>
            )}
            {props.currentImageGeneratedAt && (
              <Badge variant="outline">
                Generata: {formatDateTime(props.currentImageGeneratedAt)}
              </Badge>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Stato: immagine presente */}
      {hasImage && (
        <div className="space-y-2">
          <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-md border border-border">
            {props.currentImageSignedUrl && (
              <Image
                src={props.currentImageSignedUrl}
                alt="Immagine del post"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            )}
          </div>

          {!editingPrompt && (
            <div className="rounded-md border border-border bg-surface-muted p-2">
              <div className="mb-1 text-xs font-medium text-text-muted">Prompt usato</div>
              <div className="whitespace-pre-wrap text-xs text-text">
                {props.currentImagePrompt}
              </div>
            </div>
          )}

          {editingPrompt && (
            <div className="space-y-2">
              <Label htmlFor="prompt-edit">Nuovo prompt</Label>
              <Textarea
                id="prompt-edit"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2000}
                disabled={pending}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="model-edit">Modello</Label>
                <Select value={model} onValueChange={(v) => setModel(v as FluxModel)}>
                  <SelectTrigger id="model-edit" disabled={pending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flux-dev">FLUX dev (qualità piena, ~10s)</SelectItem>
                    <SelectItem value="flux-schnell">FLUX schnell (veloce, ~2s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={pending || prompt.trim().length === 0}
                  className="bg-primary text-white hover:bg-primary-hover"
                >
                  {pending ? "Generando…" : "Genera con nuovo prompt"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingPrompt(false);
                    setPrompt(props.currentImagePrompt ?? "");
                  }}
                  disabled={pending}
                >
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {!editingPrompt && !isReadonly && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={pending}>
                <RefreshCw className="mr-2 h-4 w-4" /> Rigenera stesso prompt
              </Button>
              <Button variant="outline" onClick={() => setEditingPrompt(true)} disabled={pending}>
                <Edit3 className="mr-2 h-4 w-4" /> Modifica prompt
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={pending}
                className="border-danger/40 text-danger hover:bg-danger/10"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Elimina
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Stato: vuoto + mutable */}
      {!hasImage && !isReadonly && !showPromptForm && (
        <Button
          onClick={handleSuggest}
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {pending ? "Claude sta pensando…" : "Suggerisci prompt immagine"}
        </Button>
      )}

      {/* Stato: prompt suggerito (form) */}
      {!hasImage && !isReadonly && showPromptForm && (
        <div className="space-y-2">
          <Label htmlFor="prompt-new">Prompt (modificabile prima di generare)</Label>
          <Textarea
            id="prompt-new"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="warm cozy interior at dusk, terracotta tones..."
            disabled={pending}
          />
          <p className="text-xs text-text-muted">
            Il prompt è in inglese per compatibilità con FLUX. Puoi modificarlo o cliccare
            &quot;Suggerisci di nuovo&quot;.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model-new">Modello</Label>
            <Select value={model} onValueChange={(v) => setModel(v as FluxModel)}>
              <SelectTrigger id="model-new" disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flux-dev">FLUX dev (qualità piena, ~10s)</SelectItem>
                <SelectItem value="flux-schnell">FLUX schnell (veloce, ~2s)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerate}
              disabled={pending || prompt.trim().length === 0}
              className="bg-primary text-white hover:bg-primary-hover"
            >
              {pending ? "Generando immagine… (5-15s)" : "Genera immagine"}
            </Button>
            <Button variant="outline" onClick={handleSuggest} disabled={pending}>
              <Sparkles className="mr-2 h-4 w-4" /> Suggerisci di nuovo
            </Button>
          </div>
        </div>
      )}

      {/* Stato: readonly senza immagine */}
      {!hasImage && isReadonly && (
        <p className="text-sm text-text-muted">
          Nessuna immagine associata a questa bozza (stato {props.status}, non modificabile).
        </p>
      )}
    </section>
  );
}
