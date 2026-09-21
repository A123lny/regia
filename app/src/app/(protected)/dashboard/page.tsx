import { getSessionOrRedirect } from "@/lib/auth/session";
import { getDashboardStats } from "@/modules/m12-daily-use/public";
import { MetricCard } from "@/components/dashboard/metric-card";
import { EnvironmentBadge } from "@/components/dashboard/environment-badge";
import { BrandChip } from "@/components/brand/brand-chip";

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const session = await getSessionOrRedirect();
  const stats = await getDashboardStats(session.organizationId);

  return (
    <div className="relative space-y-8">
      {/* Header con blob decor top-right (subtle, non invasivo) */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8">
        {/* Blob decor SVG (i 4 marchi) — solo nell'angolo destro, opacità bassa */}
        <svg
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-40"
          viewBox="0 0 400 400"
          aria-hidden="true"
        >
          <defs>
            <filter id="dashBlobBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="40" />
            </filter>
          </defs>
          <g filter="url(#dashBlobBlur)" opacity="0.85">
            <circle cx="120" cy="120" r="90" fill="#FF6B35" />
            <circle cx="280" cy="140" r="80" fill="#1E5F8C" />
            <circle cx="140" cy="280" r="85" fill="#8C5E1E" />
            <circle cx="290" cy="290" r="90" fill="#3E4C59" />
          </g>
        </svg>
        <div className="relative">
          <h1
            className="text-4xl font-extrabold uppercase tracking-[0.08em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Buongiorno
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Panoramica di oggi. Come sta andando la piattaforma.
          </p>
        </div>
      </header>

      <section aria-labelledby="todo">
        <h2 id="todo" className="mb-3 font-serif text-xl font-semibold text-text">
          Cosa devi fare
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Contenuti da approvare"
            value={stats.toDo.contentsPending}
            {...(stats.toDo.contentsPending === 0 && { footer: "Attivo in F2" })}
          />
          <MetricCard
            label="Recensioni da gestire"
            value={stats.toDo.reviewsPending}
            {...(stats.toDo.reviewsPending === 0 && { footer: "Attivo in F2" })}
          />
          <MetricCard
            label="Ristoranti in raffreddamento"
            value={stats.toDo.restaurantsCooling}
            {...(stats.toDo.restaurantsCooling === 0 && { footer: "Attivo in F3" })}
          />
          <MetricCard
            label="Allarmi costi"
            value={stats.toDo.costAlerts}
            {...(stats.toDo.costAlerts === 0 && { footer: "Attivo in F2" })}
          />
        </div>
      </section>

      <section aria-labelledby="going" className="space-y-4">
        <h2 id="going" className="font-serif text-xl font-semibold text-text">
          Come sta andando
        </h2>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h3 className="mb-3 text-sm font-medium text-text-muted">Marchi attivi</h3>
          <div className="flex flex-wrap gap-2">
            {stats.going.brands.map((b) => (
              <BrandChip key={b.slug} brand={b.slug as BrandSlug} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-6">
            <h3 className="mb-2 text-sm font-medium text-text-muted">Ultimo accesso al sistema</h3>
            <p className="text-base text-text">{formatDate(stats.going.lastAuthEventAt)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h3 className="mb-2 text-sm font-medium text-text-muted">Ultimo backup</h3>
            <p className="text-base text-text">{formatDate(stats.going.lastBackupAt)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h3 className="mb-2 text-sm font-medium text-text-muted">Ambiente</h3>
            <EnvironmentBadge environment={stats.going.environment} />
          </div>
        </div>
      </section>
    </div>
  );
}
