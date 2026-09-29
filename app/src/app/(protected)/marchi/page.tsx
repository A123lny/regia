import { getSessionOrRedirect } from "@/lib/auth/session";
import { listBrands } from "@/modules/m02-brand/public";
import { BrandsAdminClient } from "./brands-admin-client";
import { HelpButton } from "@/components/help/help-button";

export default async function MarchiPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const session = await getSessionOrRedirect();
  const { showArchived: showArchivedParam } = await searchParams;
  const showArchived = showArchivedParam === "1";
  const brands = await listBrands(session.organizationId, showArchived ? "archived" : "active");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Marchi
          </h1>
          <HelpButton pageKey="marchi" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Aggiungi, modifica, archivia i marchi del gruppo (RF-2.1). Il brand kit (tono, contesto,
          rubriche, vincoli) si apre dalla riga del marchio.
        </p>
      </header>

      <BrandsAdminClient brands={brands} showArchived={showArchived} />
    </div>
  );
}
