"use client";

// UI di amministrazione marchi: aggiungi / modifica / archivia / ripristina.
// Server actions gia esistenti in m02-brand/public. Dialog nativi (no shadcn dialog).

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Palette,
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createBrand,
  updateBrand,
  archiveBrand,
  restoreBrand,
  uploadBrandLogo,
  removeBrandLogo,
  BRAND_FONTS_ALLOWED,
  type Brand,
} from "@/modules/m02-brand/public";
import { BrandLogo } from "@/components/brand/brand-logo";

type Props = {
  brands: Brand[];
  showArchived: boolean;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function BrandsAdminClient({ brands, showArchived }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleArchive(brand: Brand) {
    setBusyId(brand.id);
    startTransition(async () => {
      try {
        await archiveBrand(brand.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore archiviazione");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleRestore(brand: Brand) {
    setBusyId(brand.id);
    startTransition(async () => {
      try {
        await restoreBrand(brand.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore ripristino");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button
            type="button"
            onClick={() => setError(null)}
            className="underline"
            aria-label="Chiudi errore"
          >
            chiudi
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/marchi"
            className={`rounded-md px-2.5 py-1 font-medium ${
              !showArchived
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-surface-muted"
            }`}
          >
            Attivi
          </Link>
          <Link
            href="/marchi?showArchived=1"
            className={`rounded-md px-2.5 py-1 font-medium ${
              showArchived ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-muted"
            }`}
          >
            Archiviati
          </Link>
        </div>
        {!showArchived && (
          <Button
            className="bg-primary text-white hover:bg-primary-hover"
            onClick={() => setCreating(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Aggiungi marchio
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="w-16 p-3">Logo</th>
              <th className="p-3">Marchio</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Colore</th>
              <th className="p-3">Creato</th>
              <th className="w-10 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {brands.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-text-muted">
                  {showArchived
                    ? "Nessun marchio archiviato."
                    : "Nessun marchio attivo. Clicca 'Aggiungi marchio' per crearne uno."}
                </td>
              </tr>
            ) : (
              brands.map((b) => (
                <tr
                  key={b.id}
                  className={`border-b border-border/60 last:border-0 hover:bg-surface-muted ${
                    b.isArchived ? "opacity-60" : ""
                  }`}
                >
                  <td className="p-3">
                    <BrandLogo logoUrl={b.logoUrl} name={b.displayName} size="md" rounded="md" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{b.displayName}</span>
                      {b.isArchived && (
                        <span className="rounded-full border border-text-muted/30 bg-text-muted/10 px-2 py-0.5 text-[10px] font-medium uppercase text-text-muted">
                          Archiviato
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{b.slug}</code>
                  </td>
                  <td className="p-3">
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                      {b.color}
                    </code>
                  </td>
                  <td className="p-3 text-text-muted">{formatDate(b.createdAt)}</td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded p-1 text-text-muted hover:bg-surface-muted"
                          aria-label={`Azioni per ${b.displayName}`}
                          disabled={busyId === b.id}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem asChild>
                          <Link href={`/marchi/${b.slug}`}>
                            <ExternalLink className="mr-2 h-4 w-4" /> Apri brand kit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(b)}>
                          <Pencil className="mr-2 h-4 w-4" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {b.isArchived ? (
                          <DropdownMenuItem onSelect={() => handleRestore(b)}>
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Ripristina
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => handleArchive(b)}
                            className="text-danger focus:text-danger"
                          >
                            <Archive className="mr-2 h-4 w-4" /> Archivia
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <BrandFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onError={setError}
          onSuccess={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      {editing && (
        <BrandFormDialog
          mode="edit"
          brand={editing}
          onClose={() => setEditing(null)}
          onError={setError}
          onSuccess={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BrandFormDialog({
  mode,
  brand,
  onClose,
  onSuccess,
  onError,
}: {
  mode: "create" | "edit";
  brand?: Brand;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState(brand?.displayName ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [color, setColor] = useState(brand?.color ?? "#c25a3b");
  const [fontFamily, setFontFamily] = useState(brand?.fontFamily ?? "Bricolage");
  const [emailFromAddress, setEmailFromAddress] = useState(brand?.emailFromAddress ?? "");
  const [emailFromDisplayName, setEmailFromDisplayName] = useState(
    brand?.emailFromDisplayName ?? "",
  );
  const [emailReplyTo, setEmailReplyTo] = useState(brand?.emailReplyTo ?? "");
  const [googlePlaceId, setGooglePlaceId] = useState(brand?.googlePlaceId ?? "");
  const [openingHours, setOpeningHours] = useState<
    import("@/modules/m02-brand/public").OpeningHours | null
  >(brand?.openingHours ?? null);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  // File logo selezionato in mode=create (upload avviene DOPO la creazione del brand)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  function handleNameChange(v: string) {
    setDisplayName(v);
    if (!slugTouched && mode === "create") {
      setSlug(slugify(v));
    }
  }

  function handleLogoFileChoice(file: File | null) {
    setPendingLogoFile(file);
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "create") {
        const created = await createBrand({ displayName, slug, color });
        // fontFamily settato subito dopo (createBrand non lo accetta ancora — resta default)
        if (fontFamily !== "Bricolage") {
          try {
            await updateBrand(created.id, { fontFamily });
          } catch {
            /* font default applicato, non blocca */
          }
        }
        // Sequenziale: dopo aver creato il brand, se c'e un file, uploadalo.
        // Se upload fallisce, il brand esiste comunque — Owner puo ricaricare dopo.
        if (pendingLogoFile) {
          try {
            const fd = new FormData();
            fd.set("logo", pendingLogoFile);
            await uploadBrandLogo(created.id, fd);
          } catch (uploadErr) {
            onError(
              `Marchio creato ma logo non caricato: ${
                uploadErr instanceof Error ? uploadErr.message : "errore upload"
              }. Ricaricalo con Modifica → Logo.`,
            );
            onSuccess();
            return;
          }
        }
      } else if (brand) {
        await updateBrand(brand.id, {
          displayName,
          slug,
          color,
          fontFamily,
          emailFromAddress: emailFromAddress.trim() || null,
          emailFromDisplayName: emailFromDisplayName.trim() || null,
          emailReplyTo: emailReplyTo.trim() || null,
          googlePlaceId: googlePlaceId.trim() || null,
          openingHours,
        });
      }
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="mb-4 text-xl font-bold text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {mode === "create" ? "Aggiungi marchio" : `Modifica ${brand?.displayName}`}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-text">Nome</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              maxLength={60}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              placeholder="es. Nuovo marchio"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-text">Slug</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugTouched(true);
              }}
              required
              pattern="^[a-z][a-z0-9-]{1,49}$"
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus:border-primary focus:outline-none"
              placeholder="es. nuovo-marchio"
            />
            <span className="mt-1 block text-[10px] text-text-muted">
              a-z, 0-9, trattino. Deve iniziare con una lettera.{" "}
              {mode === "edit" && (
                <strong className="text-warning">
                  Attenzione: cambiare lo slug rompe URL bookmarkati.
                </strong>
              )}
            </span>
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-medium text-text">
              <Palette className="h-3.5 w-3.5" /> Colore identita
            </span>
            <div className="mt-1 flex items-center gap-2">
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
                required
                pattern="^#[0-9A-Fa-f]{6}$"
                className="flex-1 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-text focus:border-primary focus:outline-none"
                placeholder="#RRGGBB"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text">Font tipografico (RF-2.2)</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              {BRAND_FONTS_ALLOWED.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <span
              className="mt-2 block rounded-md border border-border bg-surface-muted p-3 text-lg"
              style={{ fontFamily: `${fontFamily}, sans-serif` }}
            >
              Aa Bb Cc — {displayName || "Anteprima nome marchio"}
            </span>
          </label>

          {/* Upload logo — disponibile solo in mode edit (serve brand.id) */}
          {mode === "edit" && brand && (
            <BrandLogoUploader
              brand={brand}
              onError={onError}
              onChanged={() => {
                // Non chiudo il dialog: l'Owner puo continuare a modificare altri campi
              }}
            />
          )}

          {/* RF-2.2a Identita email per marchio (solo mode edit) */}
          {mode === "edit" && brand && (
            <div className="rounded-md border border-border bg-surface-muted/40 p-3">
              <div className="mb-2">
                <span className="text-xs font-medium text-text">Identita email (RF-2.2a)</span>
                <p className="text-[10px] text-text-muted">
                  Usato quando M5 pubblisher spedira email. Il dominio deve avere SPF/DKIM
                  configurati (config, non codice).
                </p>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[10px] font-medium text-text-muted">Nome visualizzato</span>
                  <input
                    type="text"
                    value={emailFromDisplayName}
                    onChange={(e) => setEmailFromDisplayName(e.target.value)}
                    maxLength={100}
                    placeholder="es. Lenny — la nostra cucina"
                    className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-text-muted">
                    Indirizzo mittente
                  </span>
                  <input
                    type="email"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    placeholder="es. hello@lenny.it"
                    className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-text focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-text-muted">
                    Reply-to (opzionale)
                  </span>
                  <input
                    type="email"
                    value={emailReplyTo}
                    onChange={(e) => setEmailReplyTo(e.target.value)}
                    placeholder="es. info@lenny.it"
                    className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-text focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
            </div>
          )}

          {/* RF-8.1 Google Place ID per M08 recensioni (solo mode edit) */}
          {mode === "edit" && brand && (
            <div className="rounded-md border border-border bg-surface-muted/40 p-3">
              <div className="mb-2">
                <span className="text-xs font-medium text-text">
                  Google Place ID (RF-8.1, opzionale)
                </span>
                <p className="text-[10px] text-text-muted">
                  Serve per il fetcher recensioni M08. Lascia vuoto se il marchio non ha scheda
                  Google.
                </p>
              </div>
              <label className="block">
                <span className="text-[10px] font-medium text-text-muted">Place ID</span>
                <input
                  type="text"
                  value={googlePlaceId}
                  onChange={(e) => setGooglePlaceId(e.target.value)}
                  placeholder="es. ChIJN1t_tDeuEmsRUsoyG83frY4"
                  className="mt-0.5 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-text focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-text-muted">
                  Trovalo su{" "}
                  <a
                    className="underline"
                    href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                    target="_blank"
                    rel="noopener"
                  >
                    developers.google.com
                  </a>
                  .
                </p>
              </label>
              <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
            </div>
          )}
          {mode === "create" && (
            <div className="rounded-md border border-border bg-surface-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-text">Logo (opzionale)</span>
                <span className="text-[10px] text-text-muted">
                  PNG · JPEG · WebP · SVG · max 2MB
                </span>
              </div>
              <div className="flex items-center gap-3">
                <BrandLogo
                  logoUrl={pendingLogoPreview}
                  name={displayName || "Nuovo marchio"}
                  size="xl"
                  rounded="md"
                />
                <div className="flex-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/40">
                    <Upload className="h-3.5 w-3.5" />
                    {pendingLogoFile ? "Sostituisci file" : "Scegli file"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        handleLogoFileChoice(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {pendingLogoFile && (
                    <button
                      type="button"
                      onClick={() => handleLogoFileChoice(null)}
                      className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                    </button>
                  )}
                  {pendingLogoFile && (
                    <p className="mt-1 text-[10px] text-text-muted">
                      {pendingLogoFile.name} · {Math.round(pendingLogoFile.size / 1024)}KB — verra
                      caricato dopo la creazione.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName.trim() || !slug.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Salvo…" : mode === "create" ? "Crea" : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Sotto-componente: sezione upload/remove logo dentro il dialog di edit.
// Isolato in un componente a se perche l'upload usa FormData e non deve rientrare
// nel form principale del dialog (che gestisce nome/slug/colore).
function BrandLogoUploader({
  brand,
  onError,
  onChanged,
}: {
  brand: Brand;
  onError: (msg: string) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(brand.logoUrl);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("logo", file);
      const updated = await uploadBrandLogo(brand.id, fd);
      setCurrentLogoUrl(updated.logoUrl);
      onChanged();
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore upload logo");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Rimuovere il logo del marchio?")) return;
    setBusy(true);
    try {
      const updated = await removeBrandLogo(brand.id);
      setCurrentLogoUrl(updated.logoUrl);
      onChanged();
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore rimozione logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text">Logo</span>
        <span className="text-[10px] text-text-muted">PNG · JPEG · WebP · SVG · max 2MB</span>
      </div>
      <div className="flex items-center gap-3">
        <BrandLogo logoUrl={currentLogoUrl} name={brand.displayName} size="xl" rounded="md" />
        <div className="flex-1 space-y-2">
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/40 ${
              busy ? "opacity-50" : ""
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {busy ? "In corso..." : currentLogoUrl ? "Sostituisci" : "Carica logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = ""; // reset per permettere re-upload stesso file
              }}
            />
          </label>
          {currentLogoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Rimuovi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// RN-76 Editor orari apertura settimanali. UI compatta: toggle per giorno + 1
// fascia principale (open/close). Fasce multiple (es. pranzo+cena) non editabili
// qui per semplicità UI; se già presenti vengono preservate ma non visualizzate
// come tali — in futuro upgrade a editor avanzato.
function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: import("@/modules/m02-brand/public").OpeningHours | null;
  onChange: (v: import("@/modules/m02-brand/public").OpeningHours | null) => void;
}) {
  const WEEKDAY_SHORT: Record<string, string> = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mer",
    thursday: "Gio",
    friday: "Ven",
    saturday: "Sab",
    sunday: "Dom",
  };
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  const enabled = value !== null;

  function updateDay(day: (typeof days)[number], open: string, close: string) {
    const current = value ?? {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    const next = { ...current, [day]: open && close ? [{ open, close }] : [] };
    onChange(next);
  }

  function toggleDay(day: (typeof days)[number], isOpen: boolean) {
    if (isOpen) {
      updateDay(day, "07:30", "19:30");
    } else {
      updateDay(day, "", "");
    }
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-text">Orari apertura (RN-76)</div>
          <p className="text-[10px] text-text-muted">
            Un solo posto nel sistema. Alimentano scheda Google, risposte automatiche, contenuti.
          </p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              if (!e.target.checked) onChange(null);
              else {
                onChange({
                  monday: [{ open: "07:30", close: "19:30" }],
                  tuesday: [{ open: "07:30", close: "19:30" }],
                  wednesday: [{ open: "07:30", close: "19:30" }],
                  thursday: [{ open: "07:30", close: "19:30" }],
                  friday: [{ open: "07:30", close: "19:30" }],
                  saturday: [{ open: "07:30", close: "19:30" }],
                  sunday: [],
                });
              }
            }}
          />
          <span className="text-text-muted">Configura</span>
        </label>
      </div>
      {enabled && value && (
        <div className="space-y-1.5">
          {days.map((d) => {
            const slot = value[d][0];
            const isOpen = Boolean(slot);
            return (
              <div key={d} className="flex items-center gap-2 text-xs">
                <span className="w-10 font-medium text-text">{WEEKDAY_SHORT[d]}</span>
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => toggleDay(d, e.target.checked)}
                />
                {isOpen ? (
                  <>
                    <input
                      type="time"
                      value={slot?.open ?? ""}
                      onChange={(e) => updateDay(d, e.target.value, slot?.close ?? "19:30")}
                      className="rounded border border-border bg-bg px-1.5 py-0.5"
                    />
                    <span className="text-text-muted">–</span>
                    <input
                      type="time"
                      value={slot?.close ?? ""}
                      onChange={(e) => updateDay(d, slot?.open ?? "07:30", e.target.value)}
                      className="rounded border border-border bg-bg px-1.5 py-0.5"
                    />
                  </>
                ) : (
                  <span className="text-text-muted">chiuso</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!enabled && (
        <p className="text-[11px] italic text-text-muted">
          Nessun orario configurato (marchio sempre &ldquo;aperto&rdquo;, es. piattaforma digitale).
        </p>
      )}
    </div>
  );
}
