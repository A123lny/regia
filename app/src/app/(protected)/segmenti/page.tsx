// M07 Segmenti — pagina RF-1.8.

import { notFound } from "next/navigation";
import { Filter } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listSegments } from "@/modules/m07-outreach/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { SegmentsClient } from "./segments-client";

export default async function SegmentiPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "segment.read")) notFound();

  const [segments, brands] = await Promise.all([
    listSegments(session.organizationId, true),
    listBrands(session.organizationId, "active"),
  ]);

  const canCrud = hasCapability(session.role, "segment.crud");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Filter className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Segmenti
            </h1>
          </div>
          <HelpButton pageKey="segmenti" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Insiemi di contatti per marchio, definiti da criteri (RF-1.8). Recency, frequenza, valore
          speso, consensi, tag. Il conteggio è ricalcolato al salvataggio; puoi rifresharlo dal
          drawer.
        </p>
      </header>

      <SegmentsClient
        segments={segments}
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color,
        }))}
        canCrud={canCrud}
      />
    </div>
  );
}
