"use client";

// Client component per catalogo: lista + drawer dettaglio con timeline prezzi + dialog nuovo prodotto.

import { useState, useTransition } from "react";
import { PackagePlus, Archive, ArchiveRestore, DollarSign, Percent, History } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductAction,
  archiveProductAction,
  restoreProductAction,
  recordPriceChangeAction,
  updateMarginAction,
  formatCents,
  PRODUCT_UNIT_LABELS,
  PRODUCT_SOURCE_LABELS,
} from "@/modules/m01-data-hub/public";
import type {
  BrandProduct,
  ProductPriceSnapshot,
  ProductSource,
  ProductUnit,
} from "@/modules/m01-data-hub/public";

type ProductWithBrand = BrandProduct & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

type Props = {
  products: ProductWithBrand[];
  brands: Array<{ id: string; slug: string; displayName: string; color: string }>;
  canCrud: boolean;
  canManagePricing: boolean;
};

export function CatalogClient({ products, brands, canCrud, canManagePricing }: Props) {
  const [selected, setSelected] = useState<ProductWithBrand | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div />
        {canCrud && (
          <Sheet open={newProductOpen} onOpenChange={setNewProductOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <PackagePlus className="mr-2 h-4 w-4" /> Nuovo prodotto
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">Nuovo prodotto</SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <NewProductForm brands={brands} onDone={() => setNewProductOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {products.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Prodotto</th>
                <th className="w-32 p-3">Categoria</th>
                <th className="w-20 p-3">Unità</th>
                <th className="w-28 p-3 text-right">Prezzo</th>
                <th className="w-24 p-3">Margine</th>
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted ${
                    p.archivedAt ? "opacity-60" : ""
                  }`}
                >
                  <td className="p-3">
                    <BrandChip slug={p.brandSlug} name={p.brandDisplayName} color={p.brandColor} />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-text">{p.name}</div>
                    <div className="text-xs text-text-muted">
                      SKU <code>{p.sku}</code>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-text-muted">{p.category}</td>
                  <td className="p-3 text-xs text-text-muted">{PRODUCT_UNIT_LABELS[p.unit]}</td>
                  <td className="p-3 text-right font-mono text-sm">
                    {formatCents(p.priceCurrentCents)}
                  </td>
                  <td className="p-3 text-xs text-text-muted">
                    {p.minMarginPct !== null ? `${p.minMarginPct}%` : "—"}
                  </td>
                  <td className="p-3">
                    {p.archivedAt ? (
                      <Badge className="border border-border bg-surface-muted text-text-muted">
                        Archiviato
                      </Badge>
                    ) : (
                      <Badge className="border border-success/30 bg-success/15 text-success">
                        Attivo
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <ProductDetailDrawer
              product={selected}
              canCrud={canCrud}
              canManagePricing={canManagePricing}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// New product dialog form
// ============================================================================

function NewProductForm({
  brands,
  onDone,
}: {
  brands: Array<{ id: string; slug: string; displayName: string; color: string }>;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultBrandId = brands[0]?.id ?? "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const priceEuro = String(fd.get("priceEuro") ?? "").trim();
          const costEuro = String(fd.get("costEuro") ?? "").trim();
          const marginPct = String(fd.get("minMarginPct") ?? "").trim();
          const notes = String(fd.get("notes") ?? "").trim();

          const payload: Parameters<typeof createProductAction>[0] = {
            brandId: String(fd.get("brandId") ?? defaultBrandId),
            sku: String(fd.get("sku") ?? ""),
            name: String(fd.get("name") ?? ""),
            category: String(fd.get("category") ?? ""),
            unit: String(fd.get("unit") ?? "pezzo") as ProductUnit,
            source: "manuale" as ProductSource,
          };
          if (priceEuro) payload.priceCents = Math.round(parseFloat(priceEuro) * 100);
          if (costEuro) payload.costCents = Math.round(parseFloat(costEuro) * 100);
          if (marginPct) payload.minMarginPct = parseFloat(marginPct);
          if (notes) payload.notes = notes;

          const result = await createProductAction(payload);
          if (result.ok) {
            onDone();
          } else {
            setError(result.error);
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="brandId">Marchio</Label>
        <select
          id="brandId"
          name="brandId"
          required
          defaultValue={defaultBrandId}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required maxLength={50} placeholder="es. LNY-PIZZA-01" />
        </div>
        <div>
          <Label htmlFor="unit">Unità</Label>
          <select
            id="unit"
            name="unit"
            defaultValue="pezzo"
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            {(Object.keys(PRODUCT_UNIT_LABELS) as ProductUnit[]).map((u) => (
              <option key={u} value={u}>
                {PRODUCT_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required maxLength={200} />
      </div>
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Input
          id="category"
          name="category"
          required
          maxLength={100}
          placeholder="es. Pizza, Bevande, Servizio officina"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="priceEuro">Prezzo (€)</Label>
          <Input id="priceEuro" name="priceEuro" type="number" step="0.01" min={0} />
        </div>
        <div>
          <Label htmlFor="costEuro">Costo (€)</Label>
          <Input id="costEuro" name="costEuro" type="number" step="0.01" min={0} />
        </div>
        <div>
          <Label htmlFor="minMarginPct">Margine %</Label>
          <Input id="minMarginPct" name="minMarginPct" type="number" step="0.1" min={0} max={100} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} />
      </div>
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
          {pending ? "Salvo..." : "Crea prodotto"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Detail drawer: info + timeline prezzi + edit margine/prezzo
// ============================================================================

function ProductDetailDrawer({
  product,
  canCrud,
  canManagePricing,
  onClose,
}: {
  product: ProductWithBrand;
  canCrud: boolean;
  canManagePricing: boolean;
  onClose: () => void;
}) {
  const [priceHistory, setPriceHistory] = useState<ProductPriceSnapshot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Fetch storico prezzi on-demand
  useState(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/catalogo/${product.id}/prices`, { cache: "no-store" });
        if (!res.ok) throw new Error("Errore caricamento storico prezzi");
        const data = (await res.json()) as { history: ProductPriceSnapshot[] };
        setPriceHistory(data.history);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  });

  const currentPrice = priceHistory?.find((p) => p.validTo === null) ?? null;
  const isFromSync = product.source !== "manuale";

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
          {product.name}
          <BrandChip
            slug={product.brandSlug}
            name={product.brandDisplayName}
            color={product.brandColor}
          />
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-6 px-4 pb-8">
        {/* Info base */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[7rem]">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">SKU</div>
              <code className="text-text">{product.sku}</code>
            </div>
            <div className="min-w-[7rem]">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Categoria</div>
              <div className="text-text">{product.category}</div>
            </div>
            <div className="min-w-[6rem]">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Unità</div>
              <div className="text-text">{PRODUCT_UNIT_LABELS[product.unit]}</div>
            </div>
            <div className="min-w-[7rem]">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Fonte</div>
              <div className="text-text">{PRODUCT_SOURCE_LABELS[product.source]}</div>
            </div>
          </div>
          {product.notes && (
            <div className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
              <strong>Note:</strong> {product.notes}
            </div>
          )}
          {isFromSync && (
            <p className="mt-2 text-[11px] text-text-muted/70">
              Prodotto importato dal gestionale: alcuni campi potrebbero venire sovrascritti alla
              prossima sincronizzazione (RF-1.6).
            </p>
          )}
        </section>

        {/* Prezzo/costo attuale + edit form */}
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Prezzo e costo attuali</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Prezzo</div>
              <div
                className="text-2xl font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {formatCents(product.priceCurrentCents)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Costo</div>
              <div className="text-lg font-medium text-text-muted">
                {formatCents(product.costCurrentCents)}
              </div>
            </div>
          </div>

          {canManagePricing && (
            <PriceChangeForm
              productId={product.id}
              currentPriceCents={currentPrice?.priceCents ?? product.priceCurrentCents}
              currentCostCents={currentPrice?.costCents ?? product.costCurrentCents}
            />
          )}
          {!canManagePricing && (
            <p className="text-[11px] text-text-muted/70">
              Solo l&apos;Owner può modificare prezzo e costo (RF-6.11).
            </p>
          )}
        </section>

        {/* Margine minimo */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Margine minimo (RF-6.11)</h3>
          </div>
          <div className="text-sm text-text-muted">
            Sotto questa soglia il sistema segnalerà la promozione come non conveniente.
          </div>
          {canManagePricing ? (
            <MarginForm productId={product.id} currentMarginPct={product.minMarginPct} />
          ) : (
            <div className="text-lg font-medium text-text">
              {product.minMarginPct !== null ? `${product.minMarginPct}%` : "Non impostato"}
            </div>
          )}
        </section>

        {/* Timeline prezzi RF-1.5 */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Storico prezzi (RF-1.5)</h3>
          </div>
          {loading && <p className="text-xs text-text-muted">Caricamento...</p>}
          {!loading && priceHistory && priceHistory.length === 0 && (
            <p className="text-xs text-text-muted">Nessun snapshot registrato.</p>
          )}
          {priceHistory && priceHistory.length > 0 && (
            <ul className="space-y-2">
              {priceHistory.map((snap) => (
                <li key={snap.id} className="rounded-md border border-border bg-bg p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-text">
                      {formatCents(snap.priceCents)}
                    </span>
                    <span className="text-text-muted">
                      dal {new Date(snap.validFrom).toLocaleDateString("it-IT")}
                      {snap.validTo && (
                        <> al {new Date(snap.validTo).toLocaleDateString("it-IT")}</>
                      )}
                      {!snap.validTo && (
                        <span className="ml-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0 text-success">
                          attuale
                        </span>
                      )}
                    </span>
                  </div>
                  {snap.costCents !== null && (
                    <div className="mt-1 text-text-muted">Costo: {formatCents(snap.costCents)}</div>
                  )}
                  {snap.note && <div className="mt-1 italic text-text-muted">{snap.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Azioni archivia/ripristina */}
        {canCrud && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {product.archivedAt ? (
              <form
                action={async () => {
                  await restoreProductAction(product.id);
                  onClose();
                }}
              >
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  onClick={() => startTransition(() => {})}
                >
                  <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Ripristina
                </Button>
              </form>
            ) : (
              <form
                action={async () => {
                  await archiveProductAction(product.id);
                  onClose();
                }}
              >
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  className="border-danger/40 text-danger hover:bg-danger/10"
                  onClick={() => startTransition(() => {})}
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" /> Archivia
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function PriceChangeForm({
  productId,
  currentPriceCents,
  currentCostCents,
}: {
  productId: string;
  currentPriceCents: number | null;
  currentCostCents: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setSuccess(false);
        startTransition(async () => {
          const priceEuro = String(fd.get("priceEuro") ?? "").trim();
          const costEuro = String(fd.get("costEuro") ?? "").trim();
          const note = String(fd.get("note") ?? "").trim();
          if (!priceEuro) {
            setError("Prezzo obbligatorio");
            return;
          }
          const payload: Parameters<typeof recordPriceChangeAction>[0] = {
            productId,
            priceCents: Math.round(parseFloat(priceEuro) * 100),
          };
          if (costEuro) payload.costCents = Math.round(parseFloat(costEuro) * 100);
          if (note) payload.note = note;

          const result = await recordPriceChangeAction(payload);
          if (result.ok) {
            setSuccess(true);
            // Reload window per rifresh storico + prezzo corrente
            setTimeout(() => window.location.reload(), 500);
          } else {
            setError(result.error);
          }
        });
      }}
      className="mt-2 rounded-md border border-border bg-bg p-2 text-xs"
    >
      <div className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
        Registra cambio prezzo
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="priceEuro"
          type="number"
          step="0.01"
          min={0}
          placeholder="Nuovo prezzo €"
          required
          defaultValue={currentPriceCents !== null ? (currentPriceCents / 100).toFixed(2) : ""}
        />
        <Input
          name="costEuro"
          type="number"
          step="0.01"
          min={0}
          placeholder="Nuovo costo € (opzionale)"
          defaultValue={currentCostCents !== null ? (currentCostCents / 100).toFixed(2) : ""}
        />
      </div>
      <Input
        name="note"
        placeholder="Nota (es. adeguamento IVA)"
        className="mt-2"
        maxLength={200}
      />
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      {success && <p className="mt-1 text-[11px] text-success">Salvato.</p>}
      <div className="mt-2 flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "..." : "Registra"}
        </Button>
      </div>
    </form>
  );
}

function MarginForm({
  productId,
  currentMarginPct,
}: {
  productId: string;
  currentMarginPct: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<string>(
    currentMarginPct !== null ? String(currentMarginPct) : "",
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const trimmed = value.trim();
          const parsed = trimmed === "" ? null : parseFloat(trimmed);
          const result = await updateMarginAction({
            productId,
            minMarginPct: parsed,
          });
          if (!result.ok) setError(result.error);
        });
      }}
      className="flex items-center gap-2"
    >
      <Input
        type="number"
        step="0.1"
        min={0}
        max={100}
        placeholder="es. 15"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24"
      />
      <span className="text-sm text-text-muted">%</span>
      <Button type="submit" size="sm" disabled={pending} variant="outline">
        {pending ? "..." : "Salva"}
      </Button>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </form>
  );
}
