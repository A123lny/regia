// RF-3.4 Corsia veloce comunicazioni di servizio.
// Form asciutto: 1 riga in ingresso → post di servizio pronto in pochi secondi.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getBrandBySlug } from "@/modules/m02-brand/public";
import { BrandChip } from "@/components/brand/brand-chip";
import { ServiceFormClient } from "./service-form-client";

export default async function ServizioPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "content.generate")) notFound();

  const { slug } = await params;
  const brand = await getBrandBySlug(session.organizationId, slug);
  if (!brand) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/contenuti/${brand.slug}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti {brand.displayName}
        </Link>
        <div className="flex items-center gap-3">
          <BrandChip slug={brand.slug} name={brand.displayName} color={brand.color} />
          <h1
            className="flex items-center gap-2 text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            <Zap className="h-6 w-6 text-warning" /> Corsia veloce
          </h1>
        </div>
        <p className="text-sm text-text-muted">
          Comunicazioni di servizio (chiusure, orari straordinari, avvisi). Poche parole in ingresso
          → post pronto asciutto, senza linguaggio promozionale. Approvazione veloce come per gli
          altri draft.
        </p>
      </header>

      <ServiceFormClient brandId={brand.id} brandSlug={brand.slug} />
    </div>
  );
}
