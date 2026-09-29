// M07 Campagne — predisposizione. L'invio effettivo arriverà con M5.

import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listCampaigns, listSegments } from "@/modules/m07-outreach/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { CampaignsClient } from "./campaigns-client";

export default async function CampagnePage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "campaign.read")) notFound();

  const [campaigns, segments, brands] = await Promise.all([
    listCampaigns(session.organizationId),
    listSegments(session.organizationId, false),
    listBrands(session.organizationId, "active"),
  ]);

  const canCrud = hasCapability(session.role, "campaign.crud");
  const canMarkSent = hasCapability(session.role, "campaign.mark_sent");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Campagne
            </h1>
          </div>
          <HelpButton pageKey="campagne" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Predisposizione invii cross-canale. In F1 la campagna resta
          &quot;draft&quot;/&quot;scheduled&quot; finché non arriva M5; l&apos;Owner marca
          l&apos;invio effettivo qui riportando gli esiti. §8.2 vincolo: mai autonomo su primi
          contatti a pubblici nuovi.
        </p>
      </header>

      <CampaignsClient
        campaigns={campaigns}
        segments={segments}
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color,
        }))}
        canCrud={canCrud}
        canMarkSent={canMarkSent}
      />
    </div>
  );
}
