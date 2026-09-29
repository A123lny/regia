// RF-3.1 Piano editoriale multi-post per un marchio.
// L'Owner sceglie: numero bozze, data inizio, pilastri da escludere.
// La server action genera N bozze sequenziali con context accumulato (~1-3 min).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getBrandBySlug, getBrandKitWithLists } from "@/modules/m02-brand/public";
import { BrandChip } from "@/components/brand/brand-chip";
import { PlanFormClient } from "./plan-form-client";

export default async function PianoPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "content.generate")) notFound();

  const { slug } = await params;
  const brand = await getBrandBySlug(session.organizationId, slug);
  if (!brand) notFound();

  const bundle = await getBrandKitWithLists(brand.id);
  const pillars = bundle?.pillars ?? [];

  const todayIso = new Date().toISOString().slice(0, 10);

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
            className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Piano editoriale
          </h1>
        </div>
        <p className="text-sm text-text-muted">
          Genera in un colpo solo N bozze per i prossimi giorni. L&apos;AI rispetta i pesi dei
          pilastri e considera stagionalità e giorno della settimana. Le bozze nascono in stato{" "}
          <em>bozza</em>: le approverai poi (RF-3.6).
        </p>
      </header>

      {pillars.length === 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-6 text-center text-sm text-warning">
          Nessun pilastro configurato per {brand.displayName}. Aggiungili prima in{" "}
          <Link href={`/marchi/${brand.slug}`} className="underline hover:text-primary">
            brand kit
          </Link>{" "}
          — il piano ha bisogno di pilastri con pesi per distribuire i temi.
        </div>
      ) : (
        <PlanFormClient
          brandId={brand.id}
          brandSlug={brand.slug}
          brandDisplayName={brand.displayName}
          pillars={pillars.map((p) => ({ id: p.id, name: p.name, weight: p.weight }))}
          defaultStartDate={todayIso}
        />
      )}
    </div>
  );
}
