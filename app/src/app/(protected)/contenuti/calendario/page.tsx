// Calendario editoriale cross-brand (RF-3.5, RF-12.1).
// Vista aggregata dei post scheduled+published dei 4 marchi nella griglia 14 giorni.
// Il drag&drop tra giorni + quick-view modal sono in MonthGridClient (client component).

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { listScheduledByOrgBetween } from "@/modules/m03-editorial/public";
import { listBrands } from "@/modules/m02-brand/public";
import { BrandLogo } from "@/components/brand/brand-logo";
import { MonthGridClient } from "./month-grid-client";
import { HelpButton } from "@/components/help/help-button";

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  const e = addDays(end, -1).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

export default async function CalendarioGlobalePage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const session = await getSessionOrRedirect();

  const { start } = await searchParams;

  const startDate = start ? startOfDayLocal(new Date(start)) : startOfDayLocal(new Date());
  const endDate = addDays(startDate, 14);
  const prevStart = toYmd(addDays(startDate, -14));
  const nextStart = toYmd(addDays(startDate, 14));
  const todayStart = toYmd(startOfDayLocal(new Date()));
  const isToday = toYmd(startDate) === todayStart;

  const [posts, brands] = await Promise.all([
    listScheduledByOrgBetween(
      session.organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
    ),
    listBrands(session.organizationId, "active"),
  ]);

  const daysIso = Array.from({ length: 14 }, (_, i) => addDays(startDate, i).toISOString());

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1
                className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                Calendario editoriale
              </h1>
              <HelpButton pageKey="calendario" />
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Tutti i marchi. Clicca un post per l&apos;anteprima, trascinalo su un altro giorno per
              riprogrammare, apri un giorno per cambiare l&apos;ora precisa.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/contenuti/calendario?start=${prevStart}`}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 14gg prima
              </Button>
            </Link>
            <span className="min-w-[10rem] text-center font-medium">
              {formatRange(startDate, endDate)}
            </span>
            <Link href={`/contenuti/calendario?start=${nextStart}`}>
              <Button variant="outline" size="sm">
                14gg dopo <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
            {!isToday && (
              <Link href="/contenuti/calendario">
                <Button variant="ghost" size="sm">
                  Oggi
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Legenda marchi (dinamica dal DB) — logo se caricato, altrimenti placeholder */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-xs">
        {brands.map((b) => (
          <div key={b.slug} className="flex items-center gap-1.5">
            <BrandLogo logoUrl={b.logoUrl} name={b.displayName} size="xs" rounded="full" />
            <span className="font-medium text-text">{b.displayName}</span>
          </div>
        ))}
      </div>

      <MonthGridClient daysIso={daysIso} posts={posts} todayYmd={todayStart} />
    </div>
  );
}
