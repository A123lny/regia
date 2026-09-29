// RF-4.1 Libreria media per marchio.
// Griglia + upload + tag filter + search caption. Editor+Owner (brand.kit.edit).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getBrandBySlug } from "@/modules/m02-brand/public";
import { listMediaAssetsByBrand } from "@/modules/m04-media/public";
import { BrandLogo } from "@/components/brand/brand-logo";
import { MediaLibraryClient } from "./media-library-client";

export default async function MediaLibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "brand.kit.edit")) notFound();

  const { slug } = await params;
  const brand = await getBrandBySlug(session.organizationId, slug);
  if (!brand) notFound();

  const assets = await listMediaAssetsByBrand(session.organizationId, brand.id, 200);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/marchi/${brand.slug}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Brand kit {brand.displayName}
        </Link>
        <div className="flex items-center gap-3">
          <BrandLogo logoUrl={brand.logoUrl} name={brand.displayName} size="md" rounded="md" />
          <h1
            className="flex items-center gap-2 text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            <ImagePlus className="h-6 w-6 text-primary" /> Libreria media
          </h1>
        </div>
        <p className="text-sm text-text-muted">
          Immagini per i contenuti di {brand.displayName}. Carica, etichetta e riusa. Le immagini
          sono private (URL firmato per uso interno).
        </p>
      </header>

      <MediaLibraryClient brandId={brand.id} brandSlug={brand.slug} initialAssets={assets} />
    </div>
  );
}
