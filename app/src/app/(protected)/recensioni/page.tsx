// Pagina recensioni e reputazione — RF-8.1.
// Flusso giornaliero: KPI + filtri URL + tabella + drawer (Task 12).

import { notFound } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listReviews, countByStatus } from "@/modules/m08-reviews/public";
import type { ReviewClassification, ReviewStatus } from "@/modules/m08-reviews/public";
import { listBrands } from "@/modules/m02-brand/public";
import { ReviewsFilters } from "./_components/reviews-filters";
import { ReviewsTable } from "./_components/reviews-table";

type SearchParams = {
  brand?: string | string[];
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

  const brandFilter = Array.isArray(sp.brand)
    ? sp.brand
    : sp.brand
      ? [sp.brand]
      : undefined;

  const reviewFilters = {
    ...(brandFilter ? { brandIds: brandFilter } : {}),
    ...(sp.classification ? { classifications: [sp.classification as ReviewClassification] } : {}),
    ...(sp.status ? { statuses: [sp.status as ReviewStatus] } : {}),
  };

  const nowMs = new Date().getTime();

  const [reviews, counts, brands] = await Promise.all([
    listReviews(session.organizationId, reviewFilters),
    countByStatus(session.organizationId),
    listBrands(session.organizationId),
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
          Flusso giornaliero fuori dalle sessioni settimanali (RF-8.1).
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
      <div
        className="mt-1 text-3xl font-semibold"
        style={{ fontFamily: "var(--font-bricolage)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
