"use client";

// Client governance: 2 tab (Regole autonomia / Prodotti no-sconto).

import { useState, useTransition } from "react";
import { CheckCircle2, ShieldAlert, Lock, Unlock } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  updateAutonomyRuleAction,
  toggleProductDiscountForbiddenAction,
  AUTONOMY_LEVEL_LABELS,
  AUTONOMY_LEVEL_STYLES,
} from "@/modules/m13-governance/public";
import type {
  AutonomyLevel,
  AutonomyRule,
  DiscountForbiddenProduct,
} from "@/modules/m13-governance/public";

type Props = {
  rules: AutonomyRule[];
  products: DiscountForbiddenProduct[];
  canCrud: boolean;
};

type Tab = "rules" | "products";

export function GovernanceClient({ rules, products, canCrud }: Props) {
  const [tab, setTab] = useState<Tab>("rules");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("rules")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "rules"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Regole autonomia ({rules.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "products"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Prodotti a sconto vietato ({products.filter((p) => p.discountForbidden).length}/
          {products.length})
        </button>
      </div>

      {tab === "rules" && <RulesTab rules={rules} canCrud={canCrud} />}
      {tab === "products" && <ProductsTab products={products} canCrud={canCrud} />}
    </div>
  );
}

// ============================================================================
// RULES TAB
// ============================================================================

function RulesTab({ rules, canCrud }: { rules: AutonomyRule[]; canCrud: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      {rules.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-text">{r.title}</h3>
                {r.enforcedInCode && (
                  <Badge className="border border-primary/40 bg-primary/10 text-[10px] text-primary">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Applicata dal codice
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-text-muted">{r.description}</p>
              {r.referenceIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.referenceIds.map((ref) => (
                    <code
                      key={ref}
                      className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted"
                    >
                      {ref}
                    </code>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`border ${AUTONOMY_LEVEL_STYLES[r.level]}`}>
                {AUTONOMY_LEVEL_LABELS[r.level]}
              </Badge>
              {canCrud && (
                <select
                  value={r.level}
                  disabled={pending}
                  onChange={(e) => {
                    const newLevel = e.target.value as AutonomyLevel;
                    startTransition(async () => {
                      await updateAutonomyRuleAction({ kind: r.kind, level: newLevel });
                    });
                  }}
                  className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
                >
                  {(Object.keys(AUTONOMY_LEVEL_LABELS) as AutonomyLevel[]).map((l) => (
                    <option key={l} value={l}>
                      {AUTONOMY_LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PRODUCTS TAB
// ============================================================================

function ProductsTab({
  products,
  canCrud,
}: {
  products: DiscountForbiddenProduct[];
  canCrud: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
          <tr>
            <th className="w-28 p-3">Marchio</th>
            <th className="p-3">Prodotto</th>
            <th className="w-32 p-3">Categoria</th>
            <th className="p-3">Stato / motivo</th>
            {canCrud && <th className="w-32 p-3" />}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ProductRow key={p.id} product={p} canCrud={canCrud} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({ product, canCrud }: { product: DiscountForbiddenProduct; canCrud: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState(product.discountForbiddenReason ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <tr
        className={`border-b border-border/60 last:border-0 ${
          product.discountForbidden ? "bg-danger/5" : ""
        }`}
      >
        <td className="p-3">
          <BrandChip
            slug={product.brandSlug}
            name={product.brandDisplayName}
            color={product.brandColor}
          />
        </td>
        <td className="p-3">
          <div className="font-medium text-text">{product.name}</div>
          <div className="text-xs text-text-muted">
            SKU <code>{product.sku}</code>
          </div>
        </td>
        <td className="p-3 text-xs text-text-muted">{product.category}</td>
        <td className="p-3">
          {product.discountForbidden ? (
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-danger" />
              <span className="text-xs text-danger">
                <strong>Sconto vietato</strong>
                {product.discountForbiddenReason && (
                  <span className="ml-1 italic text-text-muted">
                    · {product.discountForbiddenReason}
                  </span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-xs text-text-muted">Sconti permessi</span>
          )}
        </td>
        {canCrud && (
          <td className="p-3">
            {product.discountForbidden ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await toggleProductDiscountForbiddenAction({
                      productId: product.id,
                      forbidden: false,
                    });
                  });
                }}
              >
                <Unlock className="mr-1 h-3.5 w-3.5" />
                Sblocca
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="border-danger/40 text-danger hover:bg-danger/10"
              >
                <Lock className="mr-1 h-3.5 w-3.5" />
                Blocca
              </Button>
            )}
          </td>
        )}
      </tr>
      {expanded && canCrud && !product.discountForbidden && (
        <tr>
          <td colSpan={5} className="border-b border-border/60 bg-surface-muted/40 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!reason.trim()) {
                  setError("Motivo obbligatorio");
                  return;
                }
                startTransition(async () => {
                  const result = await toggleProductDiscountForbiddenAction({
                    productId: product.id,
                    forbidden: true,
                    reason: reason.trim(),
                  });
                  if (result.ok) {
                    setExpanded(false);
                  } else {
                    setError(result.error);
                  }
                });
              }}
              className="space-y-2"
            >
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo blocco (obbligatorio, es. RF-6.15 mai sconti carburante)"
                rows={2}
                maxLength={500}
              />
              {error && <p className="text-[11px] text-danger">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending}
                  className="bg-danger text-white hover:bg-danger/90"
                >
                  {pending ? "..." : "Conferma blocco"}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
