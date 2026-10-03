"use client";

// Client provider media: tabella + sheet CRUD. RF-4.3.

import { useState, useTransition } from "react";
import { Plus, ShieldCheck, ShieldAlert, ExternalLink, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertMediaProviderAction,
  archiveMediaProviderAction,
  PROVIDER_KIND_LABELS,
  RIGHTS_HOLDER_LABELS,
  RIGHTS_HOLDER_HINTS,
  ALLOWED_USE_LABELS,
} from "@/modules/m04-media/public";
import type {
  MediaProvider,
  ProviderKind,
  RightsHolder,
  AllowedUse,
} from "@/modules/m04-media/public";

const PROVIDER_KINDS: ProviderKind[] = ["image", "video", "both"];
const RIGHTS_HOLDERS: RightsHolder[] = ["user", "provider", "shared", "public_domain"];
const ALLOWED_USES: AllowedUse[] = ["commercial", "editorial", "personal"];

// Difesa in profondita: evita href=javascript:/data: anche se qualcosa bypassa
// la validazione server-side.
function safeHref(url: string | null): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

// Settori che i T&C dei provider vietano piu' spesso (RF-4.3 hint UI).
const COMMON_RESTRICTED_SECTORS = [
  "tabacco",
  "alcool",
  "armi",
  "gioco_azzardo",
  "pornografia",
  "politica",
  "religione",
  "farmaci",
];

type Props = {
  providers: MediaProvider[];
  canManage: boolean;
};

export function ProvidersClient({ providers, canManage }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MediaProvider | null>(null);

  const active = providers.filter((p) => !p.archivedAt);
  const archived = providers.filter((p) => !!p.archivedAt);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Sheet
            open={sheetOpen}
            onOpenChange={(o) => {
              setSheetOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Registra provider
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica provider" : "Nuovo provider media"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <ProviderForm
                  initial={editing}
                  onDone={() => {
                    setSheetOpen(false);
                    setEditing(null);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun provider media registrato. Finche&apos; non ne registri uno, M04 genera solo da
          template interni (satori) — niente generazione AI esterna.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-3">Provider</th>
                <th className="w-24 p-3">Tipo</th>
                <th className="w-40 p-3">Diritti</th>
                <th className="p-3">Usi ammessi</th>
                <th className="p-3">Settori vietati</th>
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {active.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    if (canManage) {
                      setEditing(p);
                      setSheetOpen(true);
                    }
                  }}
                  className={`border-b border-border/60 last:border-0 ${
                    canManage ? "cursor-pointer hover:bg-surface-muted" : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="font-medium text-text">{p.name}</div>
                    <div className="text-xs text-text-muted">
                      <code>{p.slug}</code>
                      {safeHref(p.tosUrl) && (
                        <>
                          {" · "}
                          <a
                            href={safeHref(p.tosUrl)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-primary underline"
                          >
                            T&amp;C <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-xs">{PROVIDER_KIND_LABELS[p.providerKind]}</td>
                  <td className="p-3 text-xs">{RIGHTS_HOLDER_LABELS[p.rightsHolder]}</td>
                  <td className="p-3 text-xs">
                    {p.allowedUses.length === 0 ? (
                      <span className="italic text-text-muted">nessuno</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.allowedUses.map((u) => (
                          <Badge
                            key={u}
                            variant="outline"
                            className="border-primary/40 text-[11px]"
                          >
                            {ALLOWED_USE_LABELS[u]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {p.restrictedSectors.length === 0 ? (
                      <span className="italic text-text-muted">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.restrictedSectors.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-danger/10 px-1.5 py-0.5 text-[11px] text-danger"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {p.isActive ? (
                      <Badge className="border border-success/40 bg-success/15 text-success">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Attivo
                      </Badge>
                    ) : (
                      <Badge className="border border-warning/40 bg-warning/15 text-warning">
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        Sospeso
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {archived.length > 0 && (
        <details className="rounded-lg border border-border bg-surface-muted">
          <summary className="cursor-pointer px-3 py-2 text-xs text-text-muted">
            Archiviati ({archived.length})
          </summary>
          <ul className="divide-y divide-border/60">
            {archived.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span>
                  <strong>{p.name}</strong>{" "}
                  <span className="text-text-muted">({PROVIDER_KIND_LABELS[p.providerKind]})</span>
                </span>
                <span className="text-text-muted">
                  archiviato il {new Date(p.archivedAt ?? p.updatedAt).toLocaleDateString("it-IT")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ProviderForm({ initial, onDone }: { initial: MediaProvider | null; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [providerKind, setProviderKind] = useState<ProviderKind>(initial?.providerKind ?? "image");
  const [rightsHolder, setRightsHolder] = useState<RightsHolder>(initial?.rightsHolder ?? "user");
  const [allowedUses, setAllowedUses] = useState<AllowedUse[]>(initial?.allowedUses ?? []);
  const [restrictedSectors, setRestrictedSectors] = useState<string[]>(
    initial?.restrictedSectors ?? [],
  );
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);

  const toggleUse = (u: AllowedUse) =>
    setAllowedUses((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  const toggleSector = (s: string) =>
    setRestrictedSectors((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  async function handleArchive() {
    if (!initial) return;
    if (
      !window.confirm(
        `Archiviare "${initial.name}"? Dopo l'archiviazione la generazione via questo provider sara' bloccata.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await archiveMediaProviderAction(initial.id);
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertMediaProviderAction>[0] = {
            name: String(fd.get("name") ?? "").trim(),
            slug: String(fd.get("slug") ?? "").trim(),
            providerKind,
            rightsHolder,
            allowedUses,
            restrictedSectors,
            isActive,
          };
          if (initial) payload.providerId = initial.id;
          const tos = String(fd.get("tosUrl") ?? "").trim();
          if (tos) payload.tosUrl = tos;
          const notes = String(fd.get("verificationNotes") ?? "").trim();
          if (notes) payload.verificationNotes = notes;
          const r = await upsertMediaProviderAction(payload);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={initial?.name ?? ""}
            placeholder="es. fal.ai FLUX"
          />
        </div>
        <div>
          <Label htmlFor="slug">Slug (id tecnico)</Label>
          <Input
            id="slug"
            name="slug"
            required
            maxLength={60}
            defaultValue={initial?.slug ?? ""}
            placeholder="fal_ai_flux"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="tosUrl">URL dei T&amp;C</Label>
        <Input
          id="tosUrl"
          name="tosUrl"
          type="url"
          maxLength={500}
          defaultValue={initial?.tosUrl ?? ""}
          placeholder="https://..."
        />
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <Label className="text-sm font-semibold">Tipo di media</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PROVIDER_KINDS.map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center justify-center rounded border p-2 text-sm ${
                providerKind === k ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="providerKind"
                value={k}
                checked={providerKind === k}
                onChange={() => setProviderKind(k)}
                className="sr-only"
              />
              {PROVIDER_KIND_LABELS[k]}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <Label className="text-sm font-semibold">Chi detiene i diritti sull&apos;output</Label>
        <div className="mt-2 space-y-2">
          {RIGHTS_HOLDERS.map((rh) => (
            <label
              key={rh}
              className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${
                rightsHolder === rh ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="rightsHolder"
                value={rh}
                checked={rightsHolder === rh}
                onChange={() => setRightsHolder(rh)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium">{RIGHTS_HOLDER_LABELS[rh]}</div>
                <div className="text-xs text-text-muted">{RIGHTS_HOLDER_HINTS[rh]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <Label className="text-sm font-semibold">Usi ammessi dai T&amp;C</Label>
        <p className="mt-1 text-xs text-text-muted">
          Spuntalo solo se verificato nei T&amp;C del provider. Se nessun uso e&apos; spuntato il
          provider non potra&apos; generare nulla.
        </p>
        <div className="mt-2 space-y-1">
          {ALLOWED_USES.map((u) => (
            <label key={u} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowedUses.includes(u)}
                onChange={() => toggleUse(u)}
                className="h-4 w-4 accent-primary"
              />
              {ALLOWED_USE_LABELS[u]}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <Label className="text-sm font-semibold">Settori vietati dai T&amp;C</Label>
        <p className="mt-1 text-xs text-text-muted">
          Se il provider vieta esplicitamente un settore nei suoi T&amp;C, spuntalo. Il codice M04
          potra&apos; (quando attivo) rifiutare richieste che toccano questi settori.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMMON_RESTRICTED_SECTORS.map((s) => {
            const on = restrictedSectors.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSector(s)}
                className={`rounded border px-2 py-1 text-xs ${
                  on
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="verificationNotes">Note di verifica T&amp;C</Label>
        <Textarea
          id="verificationNotes"
          name="verificationNotes"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.verificationNotes ?? ""}
          placeholder="es. Verificato T&C del 18/09/2026, piano Enterprise. Clausola 5.2 esclude pubblicita' politica."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Provider attivo (le generazioni possono usarlo)
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-2 pt-2">
        {initial ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleArchive}
            disabled={pending}
            className="border-danger/40 text-danger hover:bg-danger/10"
          >
            <Archive className="mr-1 h-3 w-3" />
            Archivia
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Annulla
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            {pending ? "Salvo..." : "Salva"}
          </Button>
        </div>
      </div>
    </form>
  );
}
