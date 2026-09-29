// Day-view cross-brand del calendario editoriale.
// Server component: fetches post di scheduled+published nel giorno [00:00, 24:00) locale.
// Delega al client DayViewClient il rendering della griglia oraria + drag&drop + menu.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { listByOrgOnDay } from "@/modules/m03-editorial/public";
import { DayViewClient } from "./day-view-client";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmdOrNull(s: string): Date | null {
  if (!YMD_RE.test(s)) return null;
  const parts = s.split("-").map((n) => parseInt(n, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return null;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
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

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function DayViewPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await getSessionOrRedirect();

  const { date } = await params;
  const dayStart = parseYmdOrNull(date);
  if (!dayStart) {
    redirect("/contenuti/calendario");
  }

  const dayEnd = addDays(dayStart, 1);
  const todayYmd = toYmd(new Date());
  const isToday = date === todayYmd;
  const isPast = dayStart.getTime() < new Date().setHours(0, 0, 0, 0);
  const prevDate = toYmd(addDays(dayStart, -1));
  const nextDate = toYmd(addDays(dayStart, 1));

  const posts = await listByOrgOnDay(
    session.organizationId,
    dayStart.toISOString(),
    dayEnd.toISOString(),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/contenuti/calendario"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Calendario
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {formatFullDate(dayStart)}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {posts.length === 0
                ? "Nessuna pubblicazione programmata."
                : `${posts.length} pubblicazion${posts.length === 1 ? "e" : "i"}.`}
              {" Trascina una card sullo slot di destinazione per cambiare orario."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/contenuti/calendario/${prevDate}`}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Giorno prima
              </Button>
            </Link>
            <Link href={`/contenuti/calendario/${nextDate}`}>
              <Button variant="outline" size="sm">
                Giorno dopo <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
            {!isToday && (
              <Link href={`/contenuti/calendario/${todayYmd}`}>
                <Button variant="ghost" size="sm">
                  Oggi
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <DayViewClient posts={posts} dayYmd={date} isPast={isPast} />
    </div>
  );
}
