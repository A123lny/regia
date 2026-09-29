// M6a Fornitori (partner spesa) — RF-6.19.

import { notFound } from "next/navigation";
import { Truck, ShieldCheck, ShieldAlert } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listSupplyPartners } from "@/modules/m01-data-hub/public";
import { HelpButton } from "@/components/help/help-button";
import { SuppliersClient } from "./suppliers-client";

export default async function FornitoriPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "supply.read")) notFound();

  const partners = await listSupplyPartners(session.organizationId, false);
  const canCrud = hasCapability(session.role, "supply.crud");
  const withConsent = partners.filter((p) => p.generalConsent).length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Truck className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Fornitori
            </h1>
          </div>
          <HelpButton pageKey="fornitori" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Partner spesa (fornitori Lenny). RF-6.19: nessuno sconto sui loro prodotti senza il loro
          assenso — è un vincolo enforced dal codice sull&apos;emissione voucher.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">Totale attivi</div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {partners.length}
          </div>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> Con assenso
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {withConsent}
          </div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-warning">
            <ShieldAlert className="h-3.5 w-3.5" /> Senza assenso
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {partners.length - withConsent}
          </div>
        </div>
      </div>

      <SuppliersClient partners={partners} canCrud={canCrud} />
    </div>
  );
}
