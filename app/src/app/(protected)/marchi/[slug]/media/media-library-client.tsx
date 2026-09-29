"use client";

// Libreria media client: drop area upload + griglia + filtri tag + ricerca caption.
// Ogni asset: preview, caption, tag chips, menu delete/rename.

import { useState, useTransition, useMemo, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, Search, Trash2, Tag as TagIcon, Loader2, Download } from "lucide-react";
import type { MediaAsset } from "@/modules/m04-media/public";
import {
  uploadMediaAsset,
  deleteMediaAsset,
  updateMediaAssetCaption,
  updateMediaAssetTags,
} from "@/modules/m04-media/public";

type Props = {
  brandId: string;
  brandSlug: string; // reservato per future revalidatePath verso /marchi/[slug]
  initialAssets: MediaAsset[];
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

export function MediaLibraryClient({ brandId, initialAssets }: Props) {
  const router = useRouter();
  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Estrai tutti i tag esistenti (ordinati per frequenza)
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (search && !a.caption.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedTags.size > 0) {
        for (const t of selectedTags) if (!a.tags.includes(t)) return false;
      }
      return true;
    });
  }, [assets, search, selectedTags]);

  async function handleFileUpload(files: FileList | File[]) {
    setUploadError(null);
    const list = Array.from(files);
    setUploading(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.set("file", file);
        try {
          const asset = await uploadMediaAsset(brandId, fd);
          setAssets((prev) => [asset, ...prev]);
        } catch (err) {
          setUploadError(`${file.name}: ${err instanceof Error ? err.message : "errore upload"}`);
        }
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  }

  function handleDelete(a: MediaAsset) {
    if (!confirm(`Eliminare "${a.caption || "immagine"}"? Operazione irreversibile.`)) return;
    setBusyId(a.id);
    startTransition(async () => {
      try {
        await deleteMediaAsset(a.id);
        setAssets((prev) => prev.filter((x) => x.id !== a.id));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Errore eliminazione");
      } finally {
        setBusyId(null);
      }
    });
  }

  function toggleTag(t: string) {
    const next = new Set(selectedTags);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelectedTags(next);
  }

  return (
    <>
      {/* Drop zone upload */}
      <label
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-surface hover:border-primary/40"
        } ${uploading ? "opacity-60" : ""}`}
      >
        {uploading ? (
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="mb-2 h-8 w-8 text-text-muted" />
        )}
        <span className="text-sm font-medium text-text">
          {uploading ? "Upload in corso..." : "Trascina qui le immagini o clicca per selezionare"}
        </span>
        <span className="mt-1 text-[11px] text-text-muted">
          PNG · JPEG · WebP · SVG · max 20MB · multi-file
        </span>
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files) handleFileUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {uploadError && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {uploadError}{" "}
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="underline"
            aria-label="Chiudi errore"
          >
            chiudi
          </button>
        </div>
      )}

      {/* Filtri */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nella caption..."
            className="w-full rounded-md border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text focus:border-primary focus:outline-none"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <TagIcon className="h-3 w-3 text-text-muted" />
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedTags.has(t)
                    ? "bg-primary/15 text-primary"
                    : "border border-border bg-surface-muted text-text-muted hover:border-primary/40"
                }`}
              >
                {t}
              </button>
            ))}
            {selectedTags.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags(new Set())}
                className="text-[10px] text-text-muted underline hover:text-primary"
              >
                svuota
              </button>
            )}
          </div>
        )}
      </div>

      {/* Griglia */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-text-muted">
          {assets.length === 0
            ? "Nessuna immagine ancora. Carica la prima trascinandola nell'area sopra."
            : "Nessun risultato per i filtri attivi."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((a) => {
            const isEditing = editingId === a.id;
            const isBusy = busyId === a.id;
            return (
              <div
                key={a.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.signedUrl}
                  alt={a.caption || "media"}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                {/* Overlay actions on hover */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="pointer-events-auto flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : a.id)}
                      className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-text hover:bg-white"
                    >
                      {isEditing ? "Chiudi" : "Modifica"}
                    </button>
                    <div className="flex items-center gap-1">
                      <a
                        href={a.signedUrl}
                        download={`${(a.caption || "media").replace(/[^a-z0-9-]+/gi, "-").slice(0, 40)}.${
                          a.contentType === "image/png"
                            ? "png"
                            : a.contentType === "image/webp"
                              ? "webp"
                              : a.contentType === "image/svg+xml"
                                ? "svg"
                                : "jpg"
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-white/90 p-1.5 text-text hover:bg-white"
                        aria-label="Scarica alta risoluzione"
                        title="Scarica alta risoluzione (RF-4.7)"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={isBusy}
                        className="rounded-md bg-danger/90 p-1.5 text-white hover:bg-danger disabled:opacity-50"
                        aria-label="Elimina"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Info bar sotto */}
                <div className="border-t border-border p-2">
                  {isEditing ? (
                    <MetaEditor
                      asset={a}
                      onSaved={(updated) => {
                        setAssets((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                        setEditingId(null);
                      }}
                      onError={(msg) => setUploadError(msg)}
                    />
                  ) : (
                    <>
                      <div className="truncate text-[11px] font-medium text-text">
                        {a.caption || <span className="text-text-muted italic">senza caption</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-0.5">
                        {a.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-surface-muted px-1.5 py-0 text-[9px] text-text-muted"
                          >
                            {t}
                          </span>
                        ))}
                        {a.tags.length > 3 && (
                          <span className="text-[9px] text-text-muted">+{a.tags.length - 3}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[9px] text-text-muted/70">
                        {formatBytes(a.sizeBytes)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function MetaEditor({
  asset,
  onSaved,
  onError,
}: {
  asset: MediaAsset;
  onSaved: (asset: MediaAsset) => void;
  onError: (msg: string) => void;
}) {
  const [caption, setCaption] = useState(asset.caption);
  const [tagsCsv, setTagsCsv] = useState(asset.tags.join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let updated = asset;
      if (caption !== asset.caption) {
        updated = await updateMediaAssetCaption(asset.id, caption);
      }
      if (tagsCsv !== asset.tags.join(", ")) {
        updated = await updateMediaAssetTags(asset.id, tagsCsv);
      }
      onSaved(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-1">
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={500}
        placeholder="Caption"
        className="w-full rounded-md border border-border bg-bg px-1.5 py-1 text-[11px] text-text focus:border-primary focus:outline-none"
      />
      <input
        type="text"
        value={tagsCsv}
        onChange={(e) => setTagsCsv(e.target.value)}
        placeholder="tag1, tag2"
        className="w-full rounded-md border border-border bg-bg px-1.5 py-1 text-[11px] text-text focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-primary py-1 text-[10px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? "Salvo..." : "Salva"}
      </button>
    </form>
  );
}
