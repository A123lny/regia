"use client";

// RF-2.7 Card white label piattaforma in Impostazioni.
// Owner-only. Configura nome, logo, colore primario della piattaforma.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Upload, Trash2, Loader2, Layers } from "lucide-react";
import {
  updatePlatformBranding,
  uploadPlatformLogo,
  removePlatformLogo,
} from "@/modules/m11-admin/public";
import type { PlatformBranding } from "@/modules/m11-admin/public";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlatformBrandingCard({ initial }: { initial: PlatformBranding }) {
  const router = useRouter();
  const [name, setName] = useState(initial.platformName);
  const [color, setColor] = useState(initial.platformPrimaryColor ?? "#c25a3b");
  const [colorEnabled, setColorEnabled] = useState(initial.platformPrimaryColor !== null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.platformLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updatePlatformBranding({
          platformName: name,
          platformPrimaryColor: colorEnabled ? color : null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  function handleLogoUpload(file: File) {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("logo", file);
        const updated = await uploadPlatformLogo(fd);
        setLogoUrl(updated.platformLogoUrl);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore upload");
      }
    });
  }

  function handleLogoRemove() {
    if (!confirm("Rimuovere il logo piattaforma?")) return;
    startTransition(async () => {
      try {
        const updated = await removePlatformLogo();
        setLogoUrl(updated.platformLogoUrl);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore rimozione");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <Layers className="h-5 w-5 text-primary" /> Aspetto piattaforma
        </CardTitle>
        <CardDescription>
          RF-2.7 White label: personalizza nome, logo e colore primario della piattaforma. Utile se
          un giorno rivendi Regìa ad altri clienti (RN-87).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-text">Nome piattaforma</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
            <span className="mt-1 block text-[10px] text-text-muted">
              Mostrato in header, sidebar mobile, title della pagina.
            </span>
          </label>

          <div className="rounded-md border border-border bg-surface-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text">Logo piattaforma (opzionale)</span>
              <span className="text-[10px] text-text-muted">PNG · JPEG · WebP · SVG · max 2MB</span>
            </div>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo piattaforma"
                  className="h-14 w-14 rounded-md border border-border bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-surface-muted text-[10px] text-text-muted">
                  no logo
                </div>
              )}
              <div className="flex-1">
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/40 ${
                    busy ? "opacity-50" : ""
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {logoUrl ? "Sostituisci" : "Carica"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={busy}
                    className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface-muted/40 p-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={colorEnabled}
                onChange={(e) => setColorEnabled(e.target.checked)}
              />
              <span className="flex items-center gap-1.5 text-xs font-medium text-text">
                <Palette className="h-3.5 w-3.5" /> Override colore primary
              </span>
            </label>
            {colorEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-md border border-border bg-bg"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus:border-primary focus:outline-none"
                  placeholder="#RRGGBB"
                />
              </div>
            )}
            <p className="mt-1 text-[10px] text-text-muted">
              Applicato via CSS variable --primary. Ogni bottone, link, chip primary usera questo
              colore.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Salva
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
