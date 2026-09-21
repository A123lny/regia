import { getSessionOrRedirect } from "@/lib/auth/session";
import { getDashboardStats } from "@/modules/m12-daily-use/public";
import { EnvironmentBadge } from "@/components/dashboard/environment-badge";
import { Sparkles, Star, Thermometer, Bell, Database, Shield, Server } from "lucide-react";

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

const BRAND_COLOR: Record<BrandSlug, string> = {
  lenny: "#FF6B35",
  stazione: "#1E5F8C",
  "eni-cafe": "#8C5E1E",
  officina: "#3E4C59",
};

const BRAND_NAME: Record<BrandSlug, string> = {
  lenny: "Lenny",
  stazione: "Stazione",
  "eni-cafe": "Eni Cafè",
  officina: "Officina",
};

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

  const metrics = [
    {
      icon: Sparkles,
      label: "Contenuti",
      subtitle: "da approvare",
      value: stats.toDo.contentsPending,
      color: "#c25a3b",
      inactive: stats.toDo.contentsPending === 0,
    },
    {
      icon: Star,
      label: "Recensioni",
      subtitle: "da gestire",
      value: stats.toDo.reviewsPending,
      color: "#87a96b",
      inactive: stats.toDo.reviewsPending === 0,
    },
    {
      icon: Thermometer,
      label: "Ristoranti",
      subtitle: "in raffreddamento",
      value: stats.toDo.restaurantsCooling,
      color: "#d89b4a",
      inactive: stats.toDo.restaurantsCooling === 0,
    },
    {
      icon: Bell,
      label: "Allarmi",
      subtitle: "costi",
      value: stats.toDo.costAlerts,
      color: "#b04a3c",
      inactive: stats.toDo.costAlerts === 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* HERO — 4 blob brand a tutta larghezza, saluto grande */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-bg p-8 lg:p-12">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <filter id="heroBlobBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="60" />
            </filter>
          </defs>
          <g filter="url(#heroBlobBlur)" opacity="0.65">
            <circle cx="100" cy="80" r="150" fill="#FF6B35" />
            <circle cx="700" cy="100" r="140" fill="#1E5F8C" />
            <circle cx="150" cy="320" r="140" fill="#8C5E1E" />
            <circle cx="680" cy="320" r="150" fill="#3E4C59" />
          </g>
        </svg>
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[3px]" />
        <div className="relative z-10 max-w-3xl">
          <h1
            className="text-5xl font-extrabold uppercase tracking-[0.06em] text-text lg:text-6xl"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Buongiorno
          </h1>
          <p className="mt-3 text-base text-text lg:text-lg">
            Panoramica di oggi. Come sta andando la piattaforma.
          </p>
        </div>
      </section>

      {/* METRICS — 4 card con icona colorata + numero grande in Bricolage + stagger fade-in */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="group relative animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg duration-500"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                style={{ backgroundColor: `${m.color}15`, color: m.color }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div
                className="text-4xl font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {m.value}
              </div>
              <div className="mt-1 text-sm font-medium text-text">{m.label}</div>
              <div className="text-xs text-text-muted">{m.subtitle}</div>
              {m.inactive && (
                <div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted/70">
                  Attivo in F2/F3
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BRAND CARDS — 4 card grandi colorate + stagger zoom-in + hover lift + parallax ornamenti */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.going.brands.map((b, i) => {
          const slug = b.slug as BrandSlug;
          const color = BRAND_COLOR[slug];
          const name = BRAND_NAME[slug];
          return (
            <div
              key={b.slug}
              className="group relative animate-in fade-in zoom-in-95 fill-mode-backwards overflow-hidden rounded-xl p-6 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl"
              style={{
                backgroundColor: color,
                animationDelay: `${400 + i * 100}ms`,
                animationDuration: "600ms",
              }}
            >
              {/* Ornamenti animati: espansione al hover */}
              <div
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 transition-transform duration-700 ease-out group-hover:scale-150"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-black/10 transition-transform duration-700 ease-out group-hover:scale-125"
                aria-hidden="true"
              />
              <div className="relative">
                <div className="mb-8 text-xs font-medium uppercase tracking-widest text-white/70 transition-opacity duration-300 group-hover:text-white/90">
                  Marchio
                </div>
                <h3
                  className="text-3xl font-extrabold uppercase tracking-wide text-white transition-transform duration-300 group-hover:translate-x-1"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  {name}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* SYSTEM STRIP — info di sistema, orizzontale compatto */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-text-muted">Ultimo accesso</div>
            <div className="mt-0.5 truncate text-sm font-medium text-text">
              {formatDate(stats.going.lastAuthEventAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#87a96b26", color: "#5f8347" }}
          >
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-text-muted">Ultimo backup</div>
            <div className="mt-0.5 truncate text-sm font-medium text-text">
              {formatDate(stats.going.lastBackupAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#d89b4a26", color: "#a97722" }}
          >
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-text-muted">Ambiente</div>
            <div className="mt-0.5">
              <EnvironmentBadge environment={stats.going.environment} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
