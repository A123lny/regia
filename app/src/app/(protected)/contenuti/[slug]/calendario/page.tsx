import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { Button } from "@/components/ui/button";
import {
  listScheduledByBrandBetween,
  listApprovedNotScheduledByBrand,
} from "@/modules/m03-editorial/public";
import { CalendarClient } from "./calendar-client";

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

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") notFound();

  const { slug } = await params;
  const { start } = await searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: brandRow } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (!brandRow) notFound();

  const brandId = brandRow.id as string;
  const displayName = brandRow.display_name as string;

  const startDate = start ? startOfDayLocal(new Date(start)) : startOfDayLocal(new Date());
  const endDate = addDays(startDate, 14);
  const prevStart = toYmd(addDays(startDate, -14));
  const nextStart = toYmd(addDays(startDate, 14));
  const todayStart = toYmd(startOfDayLocal(new Date()));
  const isToday = toYmd(startDate) === todayStart;

  const [scheduled, approved] = await Promise.all([
    listScheduledByBrandBetween(
      brandId,
      session.organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
    ),
    listApprovedNotScheduledByBrand(brandId, session.organizationId, 50),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/contenuti/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti {displayName}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-serif text-3xl font-semibold text-text">Calendario editoriale</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/contenuti/${slug}/calendario?start=${prevStart}`}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 14gg prima
              </Button>
            </Link>
            <span className="min-w-[10rem] text-center font-medium">
              {formatRange(startDate, endDate)}
            </span>
            <Link href={`/contenuti/${slug}/calendario?start=${nextStart}`}>
              <Button variant="outline" size="sm">
                14gg dopo <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
            {!isToday && (
              <Link href={`/contenuti/${slug}/calendario`}>
                <Button variant="ghost" size="sm">
                  Oggi
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <CalendarClient
        brandSlug={slug}
        startDateIso={startDate.toISOString()}
        scheduled={scheduled}
        approved={approved}
      />
    </div>
  );
}
