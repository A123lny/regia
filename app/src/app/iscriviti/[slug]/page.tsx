// M10 landing pubblica: pagina di iscrizione senza login richiesto.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicLandingBySlug } from "@/modules/m10-signup/public";
import { SignupPublicForm } from "./signup-public-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getPublicLandingBySlug(slug);
  if (!landing) return { title: "Iscrizione" };
  // Il titolo include il brand della landing (es. "Iscrizione Lenny").
  return { title: `Iscrizione ${landing.brandDisplayName ?? slug}` };
}

export default async function IscrivitiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // includeInactive:true per distinguere "landing non esiste" (404) da
  // "landing sospesa" (pagina dedicata). Il submit usa comunque il default
  // fail-closed e rifiuta i POST su landing non attive.
  const landing = await getPublicLandingBySlug(slug, { includeInactive: true });
  if (!landing) notFound();

  // Landing sospesa: pagina dedicata invece della 404 della app (che ha
  // "Torna alla dashboard" — fuori luogo per un cliente esterno).
  if (!landing.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-4">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <h1
            className="text-2xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Iscrizioni chiuse
          </h1>
          <p className="text-sm text-text-muted">
            Al momento questa iscrizione non è attiva. Riprova più tardi o rivolgiti direttamente al
            nostro personale.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-bg p-4"
      style={{
        // Sfondo brand-colored ambient
        background: `radial-gradient(circle at 20% 10%, ${landing.brandColor}22 0%, transparent 40%), radial-gradient(circle at 80% 90%, ${landing.brandColor}22 0%, transparent 40%), var(--color-bg)`,
      }}
    >
      <div className="w-full max-w-md">
        {/* Brand banner */}
        <div
          className="mb-6 rounded-2xl p-6 text-white shadow-lg"
          style={{ backgroundColor: landing.brandColor }}
        >
          <div className="text-xs uppercase tracking-widest text-white/70">
            {landing.brandDisplayName}
          </div>
          <h1
            className="mt-2 text-3xl font-extrabold uppercase tracking-tight text-white"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {landing.headline}
          </h1>
          {landing.subheadline && (
            <p className="mt-2 text-sm text-white/90">{landing.subheadline}</p>
          )}
        </div>

        {/* Benefit badge */}
        <div className="mb-6 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
          <div className="text-xs uppercase tracking-widest text-primary/70">Il tuo benefit</div>
          <div
            className="mt-1 text-xl font-bold text-primary"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {landing.benefitHeadline}
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <SignupPublicForm
            landingSlug={landing.slug}
            audiencePrompt={landing.audiencePrompt}
            audienceResidenteLabel={landing.audienceResidenteLabel}
            audienceTuristaLabel={landing.audienceTuristaLabel}
          />
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          I tuoi dati sono trattati secondo il registro consensi. Puoi disiscriverti in qualsiasi
          momento con un clic.
        </p>
      </div>
    </main>
  );
}
