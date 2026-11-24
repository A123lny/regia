// M10 admin — pagina Iscrizioni (landing CRUD + eventi).

import { notFound } from "next/navigation";
import { QrCode, Users, TrendingUp, TicketCheck } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listLandings, listSignupEvents, getSignupStats } from "@/modules/m10-signup/public";
import { listBrands } from "@/modules/m02-brand/public";
import { listOffers } from "@/modules/m06-loyalty/public";
import { HelpButton } from "@/components/help/help-button";
import { getBrandFilterId } from "@/lib/ui/brand-filter";
import { SignupClient } from "./signup-client";

export default async function IscrizioniPage({
  searchParams,
}: {
  searchParams: Promise<{ marchio?: string }>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "signup.events.read")) notFound();

  const params = await searchParams;
  const brandId = (await getBrandFilterId(session.organizationId, params)) ?? undefined;

  const [landings, events, brands, offers, stats] = await Promise.all([
    listLandings(session.organizationId, true, brandId),
    listSignupEvents(session.organizationId, 100),
    listBrands(session.organizationId, "active"),
    listOffers(session.organizationId, false, brandId),
    getSignupStats(session.organizationId),
  ]);

  const canCrud = hasCapability(session.role, "signup.landing.crud");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <QrCode className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Iscrizioni
            </h1>
          </div>
          <HelpButton pageKey="iscrizioni" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Landing pubbliche per raccolta contatti via QR/link. Ogni landing ha un URL da stampare su
          colonnina/scontrino/locandina. doppia offerta residente/turista con una sola domanda in
          iscrizione.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Users className="h-3.5 w-3.5" /> Iscrizioni totali
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.totalEvents}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <TrendingUp className="h-3.5 w-3.5" /> Ultimi 7 giorni
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.lastWeek}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <TicketCheck className="h-3.5 w-3.5" /> Voucher benvenuto emessi
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.vouchersEmitted}
          </div>
        </div>
      </div>

      <SignupClient
        landings={landings}
        events={events}
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color,
        }))}
        offers={offers.map((o) => ({
          id: o.id,
          name: o.name,
          brandId: o.issuerBrandId,
        }))}
        canCrud={canCrud}
      />
    </div>
  );
}
