import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import {
  getDashboardStats,
  buildDashboardTasks,
  listTasks,
  listOrgUsers,
} from "@/modules/m12-daily-use/server";
import {
  listUpcomingRecurrences,
  listOpenMaterialRequests,
  computeEditorialBalance,
} from "@/modules/m03-editorial/public";
import { EnvironmentBadge } from "@/components/dashboard/environment-badge";
import { RecurrencesBanner } from "@/components/dashboard/recurrences-banner";
import { MaterialRequestsBanner } from "@/components/dashboard/material-requests-banner";
import { EditorialBalanceCard } from "@/components/dashboard/editorial-balance-card";
import { WelcomeBackBanner } from "@/components/dashboard/welcome-back-banner";
import { PressureAlertBanner } from "@/components/dashboard/pressure-alert-banner";
import { TaskListCard } from "@/components/dashboard/task-list-card";
import { getUnsubscribePressureAlerts } from "@/modules/m05-publishing/public";
import { HelpButton } from "@/components/help/help-button";
import {
  FileEdit,
  CalendarClock,
  CalendarCheck2,
  CheckCircle2,
  Database,
  Shield,
  Server,
} from "lucide-react";

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

const HERO_BLOB_POSITIONS: Array<{ cx: number; cy: number; r: number }> = [
  { cx: 100, cy: 80, r: 150 },
  { cx: 700, cy: 100, r: 140 },
  { cx: 150, cy: 320, r: 140 },
  { cx: 680, cy: 320, r: 150 },
];

const HERO_FALLBACK = "#7a6857";

export default async function DashboardPage() {
  const session = await getSessionOrRedirect();
  const [
    stats,
    upcomingRecurrences,
    materialRequests,
    editorialBalance,
    pressureAlerts,
    tasks,
    customTasks,
    orgUsers,
  ] = await Promise.all([
    getDashboardStats(session.organizationId),
    listUpcomingRecurrences(session.organizationId),
    listOpenMaterialRequests(session.organizationId),
    computeEditorialBalance(session.organizationId, 30),
    getUnsubscribePressureAlerts(session.organizationId),
    buildDashboardTasks(session.organizationId),
    listTasks({ organizationId: session.organizationId, status: "all", limit: 100 }),
    listOrgUsers(session.organizationId),
  ]);
  const heroColors = HERO_BLOB_POSITIONS.map(
    (_, i) => stats.going.brands[i]?.color ?? HERO_FALLBACK,
  );

  const metrics = [
    {
      icon: FileEdit,
      label: "Bozze",
      subtitle: "da approvare",
      value: stats.toDo.draftsPending,
      color: "#c25a3b",
      // Se ci sono bozze da processare, apri direttamente la sessione guidata (RF-3.6)
      href: stats.toDo.draftsPending > 0 ? "/contenuti/sessione" : "/contenuti?status=draft",
    },
    {
      icon: CalendarClock,
      label: "Approvate",
      subtitle: "da programmare",
      value: stats.toDo.approvedNotScheduled,
      color: "#d89b4a",
      href: "/contenuti?status=approved",
    },
    {
      icon: CalendarCheck2,
      label: "In calendario",
      subtitle: "prossimi 7 giorni",
      value: stats.toDo.scheduledUpcoming,
      color: "#87a96b",
      href: "/contenuti/calendario",
    },
    {
      icon: CheckCircle2,
      label: "Pubblicate",
      subtitle: "questa settimana",
      value: stats.toDo.publishedThisWeek,
      color: "#7a6857",
      href: "/contenuti?status=published",
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
            {HERO_BLOB_POSITIONS.map((pos, i) => (
              <circle
                key={i}
                cx={pos.cx}
                cy={pos.cy}
                r={pos.r}
                fill={heroColors[i] ?? HERO_FALLBACK}
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 bg-white/55 backdrop-blur-[3px]" />
        <div className="relative z-10 max-w-3xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-text-muted">Home</span>
            <HelpButton pageKey="dashboard" />
          </div>
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

      {/* RF-12.1 Task list unificata: segnali sistema + task manuali assegnabili */}
      <TaskListCard
        signals={tasks}
        customTasks={customTasks}
        users={orgUsers}
        currentUserId={session.userId}
      />

      {/* METRICS — 4 card cliccabili con icona colorata + numero grande in Bricolage + stagger fade-in */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.label}
              href={m.href}
              className="group relative animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
            </Link>
          );
        })}
      </div>

      {/* RICORRENZE ANNUALI — appare solo se ci sono eventi in finestra (RF-3.4) */}
      <PressureAlertBanner alerts={pressureAlerts} />
      <RecurrencesBanner items={upcomingRecurrences} />

      {/* MATERIALI DA RACCOGLIERE — foto/video pendenti (RF-3.9) */}
      <MaterialRequestsBanner items={materialRequests} />

      {/* RF-12.6 Bentornato dopo assenza */}
      <WelcomeBackBanner
        previousLoginAt={session.previousLoginAt}
        role={session.role}
        pendingDraftsCount={stats.toDo.draftsPending}
      />

      {/* EQUILIBRIO EDITORIALE — distribuzione contenuti ultimi 30gg (RF-12.3) */}
      <EditorialBalanceCard balance={editorialBalance} />

      {/* BRAND CARDS — card grandi colorate (fino a 4) + stagger zoom-in + hover lift + parallax ornamenti */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.going.brands.map((b, i) => {
          const color = b.color;
          const name = b.displayName;
          return (
            <Link
              key={b.slug}
              href={`/marchi/${b.slug}`}
              aria-label={`Apri brand kit di ${name}`}
              className="group relative block animate-in fade-in zoom-in-95 fill-mode-backwards overflow-hidden rounded-xl p-6 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
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
            </Link>
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
