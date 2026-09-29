// M10 landing pubblica RF-10.1: pagina di iscrizione senza login richiesto.

import { notFound } from "next/navigation";
import { getPublicLandingBySlug } from "@/modules/m10-signup/public";
import { SignupPublicForm } from "./signup-public-form";

export default async function IscrivitiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landing = await getPublicLandingBySlug(slug);
  if (!landing) notFound();

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
          I tuoi dati sono trattati secondo il registro consensi RF-1.4. Puoi disiscriverti in
          qualsiasi momento con un clic.
        </p>
      </div>
    </main>
  );
}
