// M01 Data Hub Blocco 2 — pagina Ordini/vendite (read-only in F1).

import { notFound } from "next/navigation";
import { ShoppingBag, TrendingUp, CheckCircle2 } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listOrders,
  getOrdersStats,
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  formatCents,
} from "@/modules/m01-data-hub/public";
import type { OrderChannel, OrderStatus } from "@/modules/m01-data-hub/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { OrdersClient } from "./orders-client";

type SearchParams = {
  brand?: string;
  channel?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function isChannel(s: string | undefined): s is OrderChannel {
  return (
    s === "delivery" ||
    s === "pickup" ||
    s === "store" ||
    s === "officina" ||
    s === "carburante" ||
    s === "online" ||
    s === "altro"
  );
}

function isStatus(s: string | undefined): s is OrderStatus {
  return s === "pending" || s === "completed" || s === "cancelled" || s === "refunded";
}

export default async function OrdiniPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "orders.read")) notFound();

  const params = await searchParams;
  const brandFilter = params.brand ?? "";
  const channelFilter = isChannel(params.channel) ? params.channel : undefined;
  const statusFilter = isStatus(params.status) ? params.status : undefined;
  const fromDate = params.from ?? "";
  const toDate = params.to ?? "";
  const page = Math.max(1, Number(params.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const [brands, stats] = await Promise.all([
    listBrands(session.organizationId, "active"),
    getOrdersStats(session.organizationId),
  ]);
  const selectedBrand = brands.find((b) => b.slug === brandFilter);

  const listInput: Parameters<typeof listOrders>[0] = {
    organizationId: session.organizationId,
    limit: PAGE_SIZE,
    offset,
  };
  if (selectedBrand) listInput.brandId = selectedBrand.id;
  if (channelFilter) listInput.channel = channelFilter;
  if (statusFilter) listInput.status = statusFilter;
  if (fromDate) listInput.fromIso = new Date(fromDate + "T00:00:00").toISOString();
  if (toDate) listInput.toIso = new Date(toDate + "T23:59:59").toISOString();

  const { items, totalCount } = await listOrders(listInput);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Ordini
            </h1>
          </div>
          <HelpButton pageKey="ordini" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Vendite cross-marchio (RF-1.2). Testata + righe con snapshot prezzo/nome. In F1 sola
          lettura: la scrittura arriva con la sincronizzazione dei gestionali (RF-1.6).
        </p>
      </header>

      {/* KPI riepilogo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <ShoppingBag className="h-3.5 w-3.5" /> Ordini totali
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <TrendingUp className="h-3.5 w-3.5" /> Ordini del mese
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.totalThisMonth}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completati mese
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.completedThisMonth}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            Fatturato mese
          </div>
          <div
            className="mt-1 text-2xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {formatCents(stats.totalCentsThisMonth)}
          </div>
        </div>
      </div>

      {/* Filtri */}
      <form method="get" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              Canale
            </span>
            <select
              name="channel"
              defaultValue={channelFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti</option>
              {(Object.keys(ORDER_CHANNEL_LABELS) as OrderChannel[]).map((c) => (
                <option key={c} value={c}>
                  {ORDER_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Stato
            </span>
            <select
              name="status"
              defaultValue={statusFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti</option>
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Dal
              </span>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Al
              </span>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            <strong>{totalCount}</strong> ordin{totalCount === 1 ? "e" : "i"}
          </p>
          <div className="flex gap-2">
            <a
              href="/ordini"
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

      <OrdersClient orders={items} />

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
          Nessun ordine trovato. In F1 lo scarico avviene dai gestionali (RF-1.6).
        </div>
      )}
    </div>
  );
}
