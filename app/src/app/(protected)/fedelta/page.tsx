// M06 Fedeltà + Voucher — panoramica RF-6.1..6.10, RF-6.26.

import { notFound } from "next/navigation";
import { Gift, TicketCheck, Users as UsersIcon, Clock } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listCounters, listOffers, getVoucherStats } from "@/modules/m06-loyalty/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { LoyaltyClient } from "./loyalty-client";

export default async function FedeltaPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "loyalty.read")) notFound();

  const [counters, offers, brands, stats] = await Promise.all([
    listCounters(session.organizationId, true),
    listOffers(session.organizationId, true),
    listBrands(session.organizationId, "active"),
    getVoucherStats(session.organizationId),
  ]);

  const canCrudCounters = hasCapability(session.role, "loyalty.crud.counters");
  const canCrudOffers = hasCapability(session.role, "loyalty.crud.offers");
  const canIssue = hasCapability(session.role, "voucher.issue");
  const canRedeem = hasCapability(session.role, "voucher.redeem");
  const canCancel = hasCapability(session.role, "voucher.cancel");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Gift className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Fedeltà
            </h1>
          </div>
          <HelpButton pageKey="fedelta" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Contatori RF-6.1, offerte RF-6.2/6.3, voucher a uso singolo RF-6.26. Il costo lo paga chi
          riceve il cliente (RF-6.9): il sistema tiene comunque il conto.
        </p>
      </header>

      {/* KPI riepilogo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <TicketCheck className="h-3.5 w-3.5" /> Voucher attivi
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.activeIssued}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <UsersIcon className="h-3.5 w-3.5" /> Riscattati (totale)
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.redeemedTotal}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Clock className="h-3.5 w-3.5" /> In scadenza 7gg
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.expiringNext7d}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Gift className="h-3.5 w-3.5" /> Offerte attive
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {offers.filter((o) => o.isActive).length}
          </div>
        </div>
      </div>

      <LoyaltyClient
        counters={counters}
        offers={offers}
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color,
        }))}
        canCrudCounters={canCrudCounters}
        canCrudOffers={canCrudOffers}
        canIssue={canIssue}
        canRedeem={canRedeem}
        canCancel={canCancel}
      />
    </div>
  );
}
