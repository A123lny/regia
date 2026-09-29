"use client";

// Client per segmenti: lista + dialog CRUD con anteprima live count.

import { useState, useTransition, useEffect } from "react";
import { Plus, Users, RefreshCw } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertSegmentAction,
  refreshSegmentAction,
  previewSegmentAction,
  summarizeCriteria,
  CONSENT_CHANNEL_LABELS,
} from "@/modules/m07-outreach/public";
import type { ConsentChannel, SegmentCriteria, SegmentRow } from "@/modules/m07-outreach/public";

type BrandOpt = { id: string; slug: string; displayName: string; color: string };

type Props = {
  segments: SegmentRow[];
  brands: BrandOpt[];
  canCrud: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SegmentsClient({ segments, brands, canCrud }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SegmentRow | null>(null);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());

  async function handleRefresh(id: string) {
    setRefreshing((prev) => new Set(prev).add(id));
    try {
      await refreshSegmentAction(id);
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      {canCrud && (
        <div className="flex justify-end">
          <Sheet
            open={dialogOpen}
            onOpenChange={(o) => {
              setDialogOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Nuovo segmento
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica segmento" : "Nuovo segmento"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <SegmentForm
                  brands={brands}
                  initial={editing}
                  onDone={() => {
                    setDialogOpen(false);
                    setEditing(null);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {segments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun segmento configurato.
          {canCrud && " Crea il primo con il bottone in alto."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Segmento</th>
                <th className="p-3">Criteri</th>
                <th className="w-24 p-3 text-right">Contatti</th>
                <th className="w-32 p-3">Aggiornato</th>
                <th className="w-16 p-3" />
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <tr
                  key={s.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    if (canCrud) {
                      setEditing(s);
                      setDialogOpen(true);
                    }
                  }}
                  className={`border-b border-border/60 last:border-0 ${
                    canCrud ? "cursor-pointer hover:bg-surface-muted" : ""
                  }`}
                >
                  <td className="p-3">
                    <BrandChip slug={s.brandSlug} name={s.brandDisplayName} color={s.brandColor} />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-text">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-text-muted">{s.description}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-text-muted">{summarizeCriteria(s.criteria)}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1 text-lg font-bold text-text">
                      <Users className="h-3.5 w-3.5 text-text-muted" />
                      {s.contactCountMaterialized}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-text-muted">{formatDate(s.refreshedAt)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={refreshing.has(s.id)}
                      onClick={() => handleRefresh(s.id)}
                      className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-primary disabled:opacity-50"
                      aria-label="Ricalcola"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshing.has(s.id) ? "animate-spin" : ""}`}
                      />
                    </button>
                  </td>
                  <td className="p-3">
                    {s.isActive ? (
                      <Badge className="border border-success/30 bg-success/15 text-success">
                        Attivo
                      </Badge>
                    ) : (
                      <Badge className="border border-border bg-surface-muted text-text-muted">
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
    </div>
  );
}

function SegmentForm({
  brands,
  initial,
  onDone,
}: {
  brands: BrandOpt[];
  initial: SegmentRow | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initial?.brandId ?? brands[0]?.id ?? "");
  const [criteria, setCriteria] = useState<SegmentCriteria>(initial?.criteria ?? {});
  const [previewCount, setPreviewCount] = useState<number | null>(
    initial?.contactCountMaterialized ?? null,
  );
  const [previewing, setPreviewing] = useState(false);

  // Preview live count con debounce
  useEffect(() => {
    let cancelled = false;
    if (!brandId) return;
    const timeout = setTimeout(async () => {
      if (cancelled) return;
      setPreviewing(true);
      try {
        const result = await previewSegmentAction({ brandId, criteria });
        if (!cancelled && result.ok) setPreviewCount(result.count);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [brandId, criteria]);

  // Accetta valori undefined esplicitamente per "unset" della chiave, senza violare
  // exactOptionalPropertyTypes (rimuoviamo la chiave invece di lasciarla come undefined).
  function updateCriteria<K extends keyof SegmentCriteria>(
    key: K,
    value: SegmentCriteria[K] | undefined,
  ) {
    setCriteria((prev) => {
      const next: SegmentCriteria = { ...prev };
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value === "") ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertSegmentAction>[0] = {
            brandId,
            name: String(fd.get("name") ?? ""),
            criteria,
            isActive: fd.get("isActive") === "on",
          };
          if (initial) payload.segmentId = initial.id;
          const desc = String(fd.get("description") ?? "").trim();
          if (desc) payload.description = desc;

          const result = await upsertSegmentAction(payload);
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="brandId">Marchio</Label>
        <select
          id="brandId"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ""}
          placeholder="es. Abituali Lenny"
        />
      </div>
      <div>
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <div className="space-y-2 rounded-md border border-border bg-bg p-3">
        <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Criteri (RF-1.8)
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="lastOrderMaxDays" className="text-xs">
              Ordini negli ultimi (giorni)
            </Label>
            <Input
              id="lastOrderMaxDays"
              type="number"
              min={1}
              value={criteria.lastOrderMaxDays ?? ""}
              onChange={(e) =>
                updateCriteria(
                  "lastOrderMaxDays",
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              placeholder="es. 30"
            />
          </div>
          <div>
            <Label htmlFor="lastOrderMinDays" className="text-xs">
              Silenzio da (giorni)
            </Label>
            <Input
              id="lastOrderMinDays"
              type="number"
              min={1}
              value={criteria.lastOrderMinDays ?? ""}
              onChange={(e) =>
                updateCriteria(
                  "lastOrderMinDays",
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              placeholder="es. 60"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="minOrderCount" className="text-xs">
              Min. numero ordini
            </Label>
            <Input
              id="minOrderCount"
              type="number"
              min={1}
              value={criteria.minOrderCount ?? ""}
              onChange={(e) =>
                updateCriteria(
                  "minOrderCount",
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              placeholder="es. 5"
            />
          </div>
          <div>
            <Label htmlFor="minSpentEuro" className="text-xs">
              Min. spesa (€)
            </Label>
            <Input
              id="minSpentEuro"
              type="number"
              min={0.01}
              step="0.01"
              value={
                criteria.minSpentCents !== undefined
                  ? (criteria.minSpentCents / 100).toString()
                  : ""
              }
              onChange={(e) =>
                updateCriteria(
                  "minSpentCents",
                  e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined,
                )
              }
              placeholder="es. 50"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="requiredConsentChannel" className="text-xs">
            Consenso richiesto su canale
          </Label>
          <select
            id="requiredConsentChannel"
            value={criteria.requiredConsentChannel ?? ""}
            onChange={(e) =>
              updateCriteria(
                "requiredConsentChannel",
                (e.target.value || undefined) as ConsentChannel | undefined,
              )
            }
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">— nessun requisito —</option>
            {(Object.keys(CONSENT_CHANNEL_LABELS) as ConsentChannel[]).map((c) => (
              <option key={c} value={c}>
                {CONSENT_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="requiredTags" className="text-xs">
              Tag richiesti (virgola)
            </Label>
            <Input
              id="requiredTags"
              value={(criteria.requiredTags ?? []).join(", ")}
              onChange={(e) => {
                const list = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                updateCriteria("requiredTags", list.length > 0 ? list : undefined);
              }}
              placeholder="es. residente"
            />
          </div>
          <div>
            <Label htmlFor="excludeTags" className="text-xs">
              Tag da escludere (virgola)
            </Label>
            <Input
              id="excludeTags"
              value={(criteria.excludeTags ?? []).join(", ")}
              onChange={(e) => {
                const list = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                updateCriteria("excludeTags", list.length > 0 ? list : undefined);
              }}
              placeholder="es. dormiente"
            />
          </div>
        </div>
      </div>

      {/* Preview live */}
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
        <div className="text-xs uppercase tracking-wider text-text-muted">
          Contatti che matchano{previewing ? " (calcolo...)" : ""}
        </div>
        <div
          className="mt-1 text-3xl font-bold text-primary"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {previewCount !== null ? previewCount : "—"}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="h-4 w-4 accent-primary"
        />
        Attivo
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
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
    </form>
  );
}
