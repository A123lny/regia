// M07 Partners — pagina Rete ristoranti Lenny (RF-7.1..7.6).

import { notFound } from "next/navigation";
import {
  UtensilsCrossed,
  CheckCircle2,
  AlertTriangle,
  PhoneOutgoing,
  Sparkles,
} from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listPartners,
  getPartnerStats,
  ONBOARDING_STATUS_LABELS,
} from "@/modules/m07-partners/public";
import type { OnboardingStatus } from "@/modules/m07-partners/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { PartnersClient } from "./partners-client";

type SearchParams = {
  status?: string;
  cooling?: string;
  cuisine?: string;
  q?: string;
};

function isStatus(s: string | undefined): s is OnboardingStatus {
  return s === "mai_partito" || s === "attivo" || s === "sospeso" || s === "uscito";
}

export default async function RistorantiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "partner.read")) notFound();

  const brands = await listBrands(session.organizationId, "active");
  const lenny = brands.find((b) => b.slug === "lenny");
  if (!lenny) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
        Marchio Lenny non trovato o archiviato. La rete ristoranti è disponibile solo per Lenny.
      </div>
    );
  }

  const params = await searchParams;
  const statusFilter = isStatus(params.status) ? params.status : undefined;
  const coolingOnly = params.cooling === "1";
  const cuisineFilter = params.cuisine ?? "";
  const query = (params.q ?? "").trim();

  const listInput: Parameters<typeof listPartners>[0] = {
    organizationId: session.organizationId,
    brandId: lenny.id,
  };
  if (statusFilter) listInput.status = statusFilter;
  if (coolingOnly) listInput.coolingOnly = true;
  if (cuisineFilter) listInput.cuisineCategory = cuisineFilter;
  if (query) listInput.query = query;

  const [partners, stats] = await Promise.all([
    listPartners(listInput),
    getPartnerStats(session.organizationId, lenny.id),
  ]);

  const cuisines = Array.from(
    new Set(partners.map((p) => p.cuisineCategory).filter((v): v is string => Boolean(v))),
  ).sort();

  const canCrud = hasCapability(session.role, "partner.crud");
  const canLogActivity = hasCapability(session.role, "partner.activity.log");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Ristoranti Lenny
            </h1>
          </div>
          <HelpButton pageKey="ristoranti" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          I ~50 ristoranti come rete di micro-partner (RF-7.1). Chi contattare, chi si sta
          raffreddando, come sta andando la relazione. Perdere un ristorante costa più di una
          promozione (RF-7.4).
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <CheckCircle2 className="h-3.5 w-3.5" /> Attivi
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.attivi}
          </div>
          <div className="text-xs text-text-muted">di {stats.total}</div>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            stats.inRaffreddamento > 0
              ? "border-warning/40 bg-warning/10"
              : "border-border bg-surface"
          }`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <AlertTriangle className="h-3.5 w-3.5" /> In raffreddamento
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.inRaffreddamento}
          </div>
          <div className="text-xs text-text-muted">priorità RF-7.4</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <PhoneOutgoing className="h-3.5 w-3.5" /> Da contattare
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.daContattare}
          </div>
          <div className="text-xs text-text-muted">&gt;30gg senza contatto</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Mai partiti
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.maiPartiti}
          </div>
          <div className="text-xs text-text-muted">onboarding pendente</div>
        </div>
      </div>

      {/* Filtri */}
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
              placeholder="nome, referente, telefono..."
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Status
            </span>
            <select
              name="status"
              defaultValue={statusFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Tutti</option>
              {(Object.keys(ONBOARDING_STATUS_LABELS) as OnboardingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ONBOARDING_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Cucina
            </span>
            <select
              name="cuisine"
              defaultValue={cuisineFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Tutte</option>
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              name="cooling"
              value="1"
              defaultChecked={coolingOnly}
              className="h-4 w-4 accent-primary"
            />
            Solo in raffreddamento
          </label>
          <p className="text-xs text-text-muted">
            <strong>{partners.length}</strong> ristorant{partners.length === 1 ? "e" : "i"}
          </p>
          <div className="flex gap-2">
            <a
              href="/ristoranti"
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

      <PartnersClient
        partners={partners}
        lennyBrandId={lenny.id}
        canCrud={canCrud}
        canLogActivity={canLogActivity}
      />

      {partners.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun ristorante trovato con questi filtri.
        </div>
      )}
    </div>
  );
}
