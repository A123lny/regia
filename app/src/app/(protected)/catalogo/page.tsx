// M01 Data Hub Blocco 2 — pagina Catalogo prodotti/servizi.
// RF-1.2 modello canonico, RF-1.5 storico prezzi (visibile nel drawer).

import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listProducts,
  listProductCategories,
  PRODUCT_SOURCE_LABELS,
} from "@/modules/m01-data-hub/public";
import type { ProductSource } from "@/modules/m01-data-hub/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { CatalogClient } from "./catalog-client";

type SearchParams = {
  brand?: string;
  category?: string;
  source?: string;
  q?: string;
  page?: string;
  showArchived?: string;
};

const PAGE_SIZE = 50;

function isSource(s: string | undefined): s is ProductSource {
  return s === "manuale" || s === "gestionale" || s === "import";
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "catalog.read")) notFound();

  const params = await searchParams;
  const brandFilter = params.brand ?? "";
  const categoryFilter = params.category ?? "";
  const sourceFilter = isSource(params.source) ? params.source : undefined;
  const query = (params.q ?? "").trim();
  const showArchived = params.showArchived === "1";
  const page = Math.max(1, Number(params.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const [brands, categories] = await Promise.all([
    listBrands(session.organizationId, "active"),
    listProductCategories(session.organizationId),
  ]);
  const selectedBrand = brands.find((b) => b.slug === brandFilter);

  const listInput: Parameters<typeof listProducts>[0] = {
    organizationId: session.organizationId,
    limit: PAGE_SIZE,
    offset,
    includeArchived: showArchived,
  };
  if (selectedBrand) listInput.brandId = selectedBrand.id;
  if (categoryFilter) listInput.category = categoryFilter;
  if (sourceFilter) listInput.source = sourceFilter;
  if (query) listInput.query = query;

  const { items, totalCount } = await listProducts(listInput);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const canCrud = hasCapability(session.role, "catalog.crud");
  const canManagePricing = hasCapability(session.role, "pricing.manage");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Catalogo
            </h1>
          </div>
          <HelpButton pageKey="catalogo" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Prodotti e servizi per marchio (RF-1.2). Prezzo e costo con storia (RF-1.5). Margine
          minimo modificabile solo dall&apos;Owner (RF-6.11).
        </p>
      </header>

      {/* Filtri form (GET) */}
      <form method="get" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Ricerca
            </span>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="SKU, nome, categoria..."
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Marchio
            </span>
            <select
              name="brand"
              defaultValue={brandFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Categoria
            </span>
            <select
              name="category"
              defaultValue={categoryFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutte</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Fonte
            </span>
            <select
              name="source"
              defaultValue={sourceFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutte</option>
              {(Object.keys(PRODUCT_SOURCE_LABELS) as ProductSource[]).map((s) => (
                <option key={s} value={s}>
                  {PRODUCT_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              name="showArchived"
              value="1"
              defaultChecked={showArchived}
              className="h-4 w-4 accent-primary"
            />
            Includi archiviati
          </label>
          <p className="text-xs text-text-muted">
            <strong>{totalCount}</strong> prodott{totalCount === 1 ? "o" : "i"}
          </p>
          <div className="flex gap-2">
            <a
              href="/catalogo"
              className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted"
            >
              Reset
            </a>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
            >
              Filtra
            </button>
          </div>
        </div>
      </form>

      <CatalogClient
        products={items}
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color,
        }))}
        canCrud={canCrud}
        canManagePricing={canManagePricing}
      />

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <a
              href={`?${new URLSearchParams({ ...(params as Record<string, string>), page: String(page - 1) }).toString()}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-text hover:border-primary/40"
            >
              ← Precedente
            </a>
          ) : (
            <span />
          )}
          <span className="text-text-muted">
            Pagina {page} di {totalPages}
          </span>
          {page < totalPages ? (
            <a
              href={`?${new URLSearchParams({ ...(params as Record<string, string>), page: String(page + 1) }).toString()}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-text hover:border-primary/40"
            >
              Successiva →
            </a>
          ) : (
            <span />
          )}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun prodotto trovato.
          {canCrud && " Usa 'Nuovo prodotto' per aggiungerne uno."}
        </div>
      )}
    </div>
  );
}
