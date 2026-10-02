"use client";

import { useState, useTransition } from "react";
import { Check, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandChip } from "@/components/brand/brand-chip";
import {
  upsertAdvertisingBudgetAction,
  toggleAdvertisingCategoryAction,
  decideAdvertisingOverrunAction,
} from "@/modules/m13-governance/public";
import type {
  AdCategory,
  AdvertisingBudgetWithSpend,
  OverrunRequestRow,
} from "@/modules/m13-governance/public";

type BrandOpt = { id: string; slug: string; displayName: string; color: string };

type Props = {
  brands: BrandOpt[];
  budgets: AdvertisingBudgetWithSpend[];
  overrunPending: OverrunRequestRow[];
  categories: AdCategory[];
  categoryLabels: Record<AdCategory, string>;
  canManage: boolean;
  canToggle: boolean;
  canDecideOverrun: boolean;
};

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2)}€`;
}

export function AdvertisingClient({
  brands,
  budgets,
  overrunPending,
  categories,
  categoryLabels,
  canManage,
  canToggle,
  canDecideOverrun,
}: Props) {
  return (
    <div className="space-y-6">
      {overrunPending.length > 0 && (
        <OverrunRequestsSection
          requests={overrunPending}
          canDecide={canDecideOverrun}
          categoryLabels={categoryLabels}
        />
      )}

      <section className="rounded-lg border border-border bg-surface">
        <header className="border-b border-border p-4">
          <h2 className="font-serif text-lg font-semibold">Tetti e interruttori</h2>
          <p className="mt-1 text-xs text-text-muted">
            Un tetto per combinazione (marchio × categoria). L&apos;interruttore parte sempre
            spento. Nessuna spesa parte se spento, qualunque sia il budget.
          </p>
        </header>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="p-3">Marchio</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Tetto mensile</th>
              <th className="p-3">Speso mese</th>
              <th className="p-3">Stato</th>
            </tr>
          </thead>
          <tbody>
            {brands.flatMap((b) =>
              categories.map((cat) => {
                const existing = budgets.find(
                  (bud) => bud.brandId === b.id && bud.category === cat,
                );
                return (
                  <BudgetRow
                    key={`${b.id}:${cat}`}
                    brand={b}
                    category={cat}
                    categoryLabel={categoryLabels[cat]}
                    budget={existing ?? null}
                    canManage={canManage}
                    canToggle={canToggle}
                  />
                );
              }),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function BudgetRow({
  brand,
  category,
  categoryLabel,
  budget,
  canManage,
  canToggle,
}: {
  brand: BrandOpt;
  category: AdCategory;
  categoryLabel: string;
  budget: AdvertisingBudgetWithSpend | null;
  canManage: boolean;
  canToggle: boolean;
}) {
  const [capEditing, setCapEditing] = useState(false);
  const [capCents, setCapCents] = useState(String(budget?.monthlyCapCents ?? 0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const enabled = budget?.enabled ?? false;
  const monthlyCap = budget?.monthlyCapCents ?? 0;
  const spent = budget?.monthSpentCents ?? 0;

  const saveCap = () => {
    const parsed = Number(capCents);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Importo non valido");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertAdvertisingBudgetAction({
        brandId: brand.id,
        category,
        monthlyCapCents: Math.round(parsed),
      });
      if (!res.ok) setError(res.error);
      else setCapEditing(false);
    });
  };

  const toggle = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleAdvertisingCategoryAction({
        brandId: brand.id,
        category,
        enabled: next,
      });
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="p-3">
        <BrandChip slug={brand.slug} name={brand.displayName} color={brand.color} />
      </td>
      <td className="p-3 text-xs">{categoryLabel}</td>
      <td className="p-3">
        {capEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={capCents}
              onChange={(e) => setCapCents(e.target.value)}
              className="w-28"
              disabled={pending}
            />
            <span className="text-xs text-text-muted">centesimi/mese</span>
            <Button type="button" size="sm" onClick={saveCap} disabled={pending}>
              Salva
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCapEditing(false);
                setCapCents(String(budget?.monthlyCapCents ?? 0));
              }}
              disabled={pending}
            >
              Annulla
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatCents(monthlyCap)}</span>
            {canManage && (
              <button
                type="button"
                onClick={() => setCapEditing(true)}
                className="text-xs text-primary underline"
              >
                modifica
              </button>
            )}
          </div>
        )}
      </td>
      <td className="p-3 text-xs text-text-muted">
        {formatCents(spent)}
        {budget && budget.monthEstimatedCents > 0 && (
          <span className="ml-1 text-amber-600">
            + {formatCents(budget.monthEstimatedCents)} stimato
          </span>
        )}
      </td>
      <td className="p-3">
        {canToggle ? (
          <button
            type="button"
            onClick={() => toggle(!enabled)}
            disabled={pending}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              enabled ? "bg-success/15 text-success" : "bg-surface-muted text-text-muted"
            }`}
          >
            {enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {enabled ? "Attivo" : "Spento"}
          </button>
        ) : (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
              enabled ? "bg-success/15 text-success" : "bg-surface-muted text-text-muted"
            }`}
          >
            {enabled ? "Attivo" : "Spento"}
          </span>
        )}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

function OverrunRequestsSection({
  requests,
  canDecide,
  categoryLabels,
}: {
  requests: OverrunRequestRow[];
  canDecide: boolean;
  categoryLabels: Record<AdCategory, string>;
}) {
  return (
    <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
        <div>
          <h2 className="font-serif text-lg font-semibold text-amber-900">
            Richieste di sforamento tetto ({requests.length})
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            RF-13.6 · Il superamento del tetto non e&apos; mai automatico. Il titolare approva o
            rifiuta ogni richiesta.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {requests.map((r) => (
          <OverrunCard
            key={r.id}
            request={r}
            canDecide={canDecide}
            categoryLabel={categoryLabels[r.category]}
          />
        ))}
      </div>
    </section>
  );
}

function OverrunCard({
  request,
  canDecide,
  categoryLabel,
}: {
  request: OverrunRequestRow;
  canDecide: boolean;
  categoryLabel: string;
}) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const decide = (decision: "approved" | "rejected") => {
    setStatus(null);
    startTransition(async () => {
      const payload: Parameters<typeof decideAdvertisingOverrunAction>[0] = {
        requestId: request.id,
        decision,
      };
      const trimmed = notes.trim();
      if (trimmed.length > 0) payload.notes = trimmed;
      const res = await decideAdvertisingOverrunAction(payload);
      setStatus(res.ok ? "Decisione registrata" : `Errore: ${res.error}`);
    });
  };

  const diff = request.requestedAmountCents - request.currentCapCents;

  return (
    <div className="rounded-md border border-amber-300 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <BrandChip
          slug={request.brandSlug}
          name={request.brandDisplayName}
          color={request.brandColor}
        />
        <span className="text-xs text-text-muted">{categoryLabel}</span>
        <span className="ml-auto text-xs text-text-muted">
          Richiesto {new Date(request.requestedAt).toLocaleString("it-IT")}
        </span>
      </div>
      <div className="mt-2 text-sm">
        <strong>Tetto corrente:</strong> {formatCents(request.currentCapCents)}
        <span className="mx-2">→</span>
        <strong>Richiesto:</strong> {formatCents(request.requestedAmountCents)}
        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
          +{formatCents(diff)}
        </span>
      </div>
      <blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-xs italic text-text-muted">
        {request.motivation}
      </blockquote>
      {canDecide && (
        <div className="mt-3 space-y-2">
          <Input
            type="text"
            placeholder="Note (opzionale)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => decide("rejected")}
              disabled={pending}
            >
              Rifiuta
            </Button>
            <Button type="button" size="sm" onClick={() => decide("approved")} disabled={pending}>
              Approva + aumenta tetto
            </Button>
          </div>
          {status && <p className="text-xs">{status}</p>}
        </div>
      )}
    </div>
  );
}
