"use client";

// RF-12.4 CRUD UI ricorrenze: lista + dialog create/edit + toggle attiva + delete.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import type { RecurringEvent } from "@/modules/m03-editorial/public";
import {
  createRecurrence,
  updateRecurrence,
  deleteRecurrence,
} from "@/modules/m03-editorial/public";
import type { Brand } from "@/modules/m02-brand/public";
import { BrandLogo } from "@/components/brand/brand-logo";

const MONTHS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const KIND_LABELS: Record<string, { label: string; badge: string }> = {
  holiday: { label: "Festività", badge: "border-primary/30 bg-primary/10 text-primary" },
  seasonal: { label: "Stagionale", badge: "border-warning/30 bg-warning/10 text-warning" },
  business: { label: "Business", badge: "border-success/30 bg-success/10 text-success" },
};

type Props = {
  recurrences: RecurringEvent[];
  brands: Brand[];
};

export function RecurrencesAdminClient({ recurrences, brands }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<RecurringEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(r: RecurringEvent) {
    if (!confirm(`Eliminare la ricorrenza "${r.name}"? Non sarà più proposta in dashboard.`))
      return;
    setBusyId(r.id);
    startTransition(async () => {
      try {
        await deleteRecurrence(r.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore eliminazione");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleToggleActive(r: RecurringEvent) {
    setBusyId(r.id);
    startTransition(async () => {
      try {
        await updateRecurrence(r.id, { isActive: !r.isActive });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally {
        setBusyId(null);
      }
    });
  }

  // Raggruppa per marchio
  const byBrand = new Map<string, RecurringEvent[]>();
  for (const r of recurrences) {
    const key = r.brandSlug;
    const bucket = byBrand.get(key);
    if (bucket) bucket.push(r);
    else byBrand.set(key, [r]);
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button type="button" onClick={() => setError(null)} className="underline">
            chiudi
          </button>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> Nuova ricorrenza
        </button>
      </div>

      {recurrences.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessuna ricorrenza. Crea la prima con &ldquo;Nuova ricorrenza&rdquo;.
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byBrand.entries()).map(([brandSlug, items]) => {
            const brand = brands.find((b) => b.slug === brandSlug);
            return (
              <div
                key={brandSlug}
                className="overflow-hidden rounded-lg border border-border bg-surface"
              >
                <div className="flex items-center gap-2 border-b border-border bg-surface-muted/60 px-3 py-2">
                  {brand && (
                    <BrandLogo
                      logoUrl={brand.logoUrl}
                      name={brand.displayName}
                      size="xs"
                      rounded="full"
                    />
                  )}
                  <span className="text-sm font-medium text-text">
                    {items[0]?.brandDisplayName ?? brandSlug}
                  </span>
                  <span className="text-xs text-text-muted">
                    ({items.length} ricorrenz{items.length === 1 ? "a" : "e"})
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="p-2">Ricorrenza</th>
                      <th className="w-24 p-2">Quando</th>
                      <th className="w-24 p-2">Preavviso</th>
                      <th className="w-24 p-2">Tipo</th>
                      <th className="w-20 p-2">Attiva</th>
                      <th className="w-24 p-2 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => {
                      const isBusy = busyId === r.id;
                      const kindMeta = KIND_LABELS[r.kind];
                      return (
                        <tr
                          key={r.id}
                          className={`border-b border-border/40 last:border-0 ${
                            r.isActive ? "" : "opacity-50"
                          }`}
                        >
                          <td className="p-2">
                            <div className="font-medium text-text">{r.name}</div>
                            <div className="text-[11px] text-text-muted">
                              tema: {r.suggestedTheme.slice(0, 80)}
                              {r.suggestedTheme.length > 80 ? "…" : ""}
                            </div>
                          </td>
                          <td className="p-2 text-xs text-text-muted">
                            {r.dayOfMonth} {MONTHS_IT[r.monthOfYear - 1]}
                          </td>
                          <td className="p-2 text-xs text-text-muted">{r.leadTimeDays}gg</td>
                          <td className="p-2">
                            {kindMeta && (
                              <span
                                className={`inline-block rounded-full border px-1.5 py-0 text-[10px] font-medium ${kindMeta.badge}`}
                              >
                                {kindMeta.label}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <label className="inline-flex cursor-pointer items-center gap-1">
                              <input
                                type="checkbox"
                                checked={r.isActive}
                                onChange={() => handleToggleActive(r)}
                                disabled={isBusy}
                              />
                              <span className="text-[10px] text-text-muted">
                                {r.isActive ? "sì" : "no"}
                              </span>
                            </label>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditing(r)}
                                disabled={isBusy}
                                className="rounded p-1 text-text-muted hover:bg-surface-muted"
                                aria-label="Modifica"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(r)}
                                disabled={isBusy}
                                className="rounded p-1 text-danger hover:bg-danger/10"
                                aria-label="Elimina"
                              >
                                {isBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <RecurrenceFormDialog
          brands={brands}
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onError={setError}
          onSuccess={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function RecurrenceFormDialog({
  brands,
  existing,
  onClose,
  onSuccess,
  onError,
}: {
  brands: Brand[];
  existing: RecurringEvent | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [brandId, setBrandId] = useState(existing?.brandId ?? brands[0]?.id ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<string>(existing?.kind ?? "seasonal");
  const [month, setMonth] = useState(existing?.monthOfYear ?? new Date().getMonth() + 1);
  const [day, setDay] = useState(existing?.dayOfMonth ?? 1);
  const [leadTime, setLeadTime] = useState(existing?.leadTimeDays ?? 14);
  const [suggestedTheme, setSuggestedTheme] = useState(existing?.suggestedTheme ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (existing) {
        await updateRecurrence(existing.id, {
          name,
          kind,
          monthOfYear: month,
          dayOfMonth: day,
          leadTimeDays: leadTime,
          suggestedTheme,
        });
      } else {
        await createRecurrence({
          brandId,
          name,
          kind,
          monthOfYear: month,
          dayOfMonth: day,
          leadTimeDays: leadTime,
          suggestedTheme,
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
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {existing ? `Modifica: ${existing.name}` : "Nuova ricorrenza"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-surface-muted"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!existing && (
            <label className="block">
              <span className="text-xs font-medium text-text">Marchio</span>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-text">Nome ricorrenza</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="es. Auguri di Natale · Cambio gomme invernali"
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-text">Mese</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              >
                {MONTHS_IT.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text">Giorno</span>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                required
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text">Preavviso (gg)</span>
              <input
                type="number"
                min={0}
                max={90}
                value={leadTime}
                onChange={(e) => setLeadTime(Number(e.target.value))}
                required
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-text">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="holiday">Festività</option>
              <option value="seasonal">Stagionale</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-text">Tema suggerito</span>
            <textarea
              value={suggestedTheme}
              onChange={(e) => setSuggestedTheme(e.target.value)}
              rows={3}
              required
              maxLength={500}
              placeholder="cosa deve dire il post (l'AI userà questo come tema base)"
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Salvo…" : existing ? "Salva" : "Crea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
