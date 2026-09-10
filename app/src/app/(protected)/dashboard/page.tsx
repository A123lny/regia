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
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Buongiorno</h1>
        <p className="mt-1 text-sm text-text-muted">
          Panoramica di oggi. Come sta andando la piattaforma.
        </p>
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
