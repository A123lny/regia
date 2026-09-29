// RF-12.2 Archivio contenuti + ricerca full-text.
// Cross-brand. Filtri: query testo · marchio · stato · date range. Paginato.

import Link from "next/link";
import { ArrowLeft, Archive, Search } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { searchArchive, TOPIC_LABELS, TOPIC_LABEL_UI } from "@/modules/m03-editorial/public";
import type { ContentDraftStatus, TopicLabel } from "@/modules/m03-editorial/public";
import { listBrands } from "@/modules/m02-brand/public";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { HelpButton } from "@/components/help/help-button";
import { TopicLabelChip } from "@/components/editorial/topic-label-chip";

type SearchParams = {
  q?: string;
  brand?: string;
  status?: string;
  topic?: string;
  from?: string;
  to?: string;
  page?: string;
};

const PAGE_SIZE = 30;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function StatusBadge({ status }: { status: ContentDraftStatus }) {
  const map: Record<ContentDraftStatus, { label: string; cls: string }> = {
    draft: { label: "Bozza", cls: "border-border bg-surface-muted text-text-muted" },
    approved: { label: "Approvato", cls: "border-success/30 bg-success/15 text-success" },
    rejected: { label: "Rifiutato", cls: "border-danger/30 bg-danger/15 text-danger" },
    scheduled: { label: "Programmato", cls: "border-primary/30 bg-primary/10 text-primary" },
    published: {
      label: "Pubblicato",
      cls: "border-text-muted/30 bg-text-muted/10 text-text-muted",
    },
  };
  const m = map[status];
  return <Badge className={`border ${m.cls}`}>{m.label}</Badge>;
}

export default async function ArchivioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  const params = await searchParams;

  const q = params.q ?? "";
  const brandFilter = params.brand ?? "";
  const statusFilter = (params.status ?? "") as ContentDraftStatus | "";
  const topicFilter = (params.topic ?? "") as TopicLabel | "";
  const fromDate = params.from ?? "";
  const toDate = params.to ?? "";
  const page = Math.max(1, Number(params.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const brands = await listBrands(session.organizationId, "active");
  const selectedBrand = brands.find((b) => b.slug === brandFilter);

  const searchInput: Parameters<typeof searchArchive>[0] = {
    organizationId: session.organizationId,
    limit: PAGE_SIZE,
    offset,
  };
  if (q.trim()) searchInput.query = q.trim();
  if (selectedBrand) searchInput.brandId = selectedBrand.id;
  if (statusFilter) searchInput.status = statusFilter;
  if (topicFilter) searchInput.topicLabel = topicFilter;
  if (fromDate) searchInput.fromDateIso = new Date(fromDate + "T00:00:00").toISOString();
  if (toDate) searchInput.toDateIso = new Date(toDate + "T23:59:59").toISOString();

  const { items, totalCount } = await searchArchive(searchInput);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Costruisco URL preservando filtri
  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (brandFilter) sp.set("brand", brandFilter);
    if (statusFilter) sp.set("status", statusFilter);
    if (topicFilter) sp.set("topic", topicFilter);
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/contenuti/archivio?${qs}` : "/contenuti/archivio";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/contenuti"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Archive className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Archivio contenuti
            </h1>
          </div>
          <HelpButton pageKey="contenuti-archivio" />
        </div>
        <p className="text-sm text-text-muted">
          RF-12.2: cerca fra tutti i contenuti generati. Filtri per marchio, stato, data.
        </p>
      </header>

      {/* Filtri form (GET) */}
      <form method="get" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Cerca testo
            </span>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="parole nel tema o nel testo generato..."
                className="w-full rounded-md border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
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
              <option value="">Tutti i marchi</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.displayName}
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
              defaultValue={statusFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti gli stati</option>
              <option value="draft">Bozza</option>
              <option value="approved">Approvato</option>
              <option value="scheduled">Programmato</option>
              <option value="published">Pubblicato</option>
              <option value="rejected">Rifiutato</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Argomento
            </span>
            <select
              name="topic"
              defaultValue={topicFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti gli argomenti</option>
              {TOPIC_LABELS.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABEL_UI[t].label}
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
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-text-muted">
            <strong>{totalCount}</strong> risultat{totalCount === 1 ? "o" : "i"}
          </p>
          <div className="flex gap-2">
            <Link
              href="/contenuti/archivio"
              className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted"
            >
              Reset
            </Link>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
            >
              Filtra
            </button>
          </div>
        </div>
      </form>

      {/* Risultati */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun contenuto trovato con questi filtri.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Tema / anteprima</th>
                <th className="w-28 p-3">Argomento</th>
                <th className="w-28 p-3">Stato</th>
                <th className="w-40 p-3">Creato</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
                >
                  <td className="p-3">
                    <BrandChip slug={d.brandSlug} name={d.brandDisplayName} color={d.brandColor} />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/contenuti/${d.brandSlug}/${d.id}`}
                      className="block hover:text-primary"
                    >
                      <div className="font-medium">{truncate(d.themeInput, 80)}</div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {truncate(d.generatedText, 120)}
                      </div>
                    </Link>
                  </td>
                  <td className="p-3">
                    <TopicLabelChip label={d.topicLabel} size="xs" />
                  </td>
                  <td className="p-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="p-3 text-xs text-text-muted">{formatDateTime(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/40"
            >
              ← Precedente
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-text-muted">
            Pagina {page} di {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/40"
            >
              Successiva →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
