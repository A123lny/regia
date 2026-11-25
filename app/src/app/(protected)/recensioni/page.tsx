import type { Metadata } from "next";

export const metadata: Metadata = { title: "Recensioni" };

// Pagina recensioni e reputazione —.
// Flusso giornaliero: KPI + filtri URL + tabella + drawer (Task 12).

import { notFound } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listReviews, countByStatus } from "@/modules/m08-reviews/public";
import type { ReviewClassification, ReviewStatus } from "@/modules/m08-reviews/public";
import { listBrands } from "@/modules/m02-brand/public";
import { getBrandFilter } from "@/lib/ui/brand-filter";
import { ReviewsFilters } from "./_components/reviews-filters";
import { AddReviewPanel } from "./_components/add-review-panel";
import { ReviewsTable } from "./_components/reviews-table";

type SearchParams = {
  brand?: string | string[];
  marchio?: string;
  classification?: string;
  status?: string;
};

export default async function RecensioniPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "reviews.read")) notFound();

  const sp = await searchParams;

  // Brand filter: local `brand` ha precedenza (già filtra per id), poi globale `marchio`
  // (slug cookie o ?marchio=): risolviamo lo slug via listBrands.
  const brands = await listBrands(session.organizationId);
  const localBrandIds = Array.isArray(sp.brand) ? sp.brand : sp.brand ? [sp.brand] : undefined;
  let brandIdsFilter: string[] | undefined = localBrandIds;
  if (!brandIdsFilter) {
    const globalSlug = await getBrandFilter(sp);
    if (globalSlug) {
      const b = brands.find((x) => x.slug === globalSlug);
      if (b) brandIdsFilter = [b.id];
    }
  }

  const reviewFilters = {
    ...(brandIdsFilter ? { brandIds: brandIdsFilter } : {}),
    ...(sp.classification ? { classifications: [sp.classification as ReviewClassification] } : {}),
    ...(sp.status ? { statuses: [sp.status as ReviewStatus] } : {}),
  };

  const nowMs = new Date().getTime();

  const [reviews, counts] = await Promise.all([
    listReviews(session.organizationId, reviewFilters),
    countByStatus(session.organizationId),
  ]);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1
          className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Recensioni e reputazione
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Flusso giornaliero fuori dalle sessioni settimanali.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Oggi" value={counts.publishedToday} hint="Pubblicate oggi" />
        <KpiCard
          label="Da rispondere"
          value={counts.pending + counts.draftReady}
          hint="Pending + bozza pronta"
        />
        <KpiCard
          label="Gravi segnalate"
          value={counts.seriousSignaled}
          hint="Casi gravi da gestire privatamente"
          danger={counts.seriousSignaled > 0}
        />
        <KpiCard label="Totale" value={reviews.length} hint="Nei filtri correnti" />
      </div>

      <AddReviewPanel
        brands={brands.map((b) => ({ id: b.id, slug: b.slug, displayName: b.displayName }))}
      />
      <ReviewsFilters brands={brands} />
      <ReviewsTable reviews={reviews} brands={brands} nowMs={nowMs} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: number;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        danger ? "border-rose-400 bg-rose-50" : "border-slate-200"
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-bricolage)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
