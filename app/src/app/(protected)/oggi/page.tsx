// Home "Oggi" — Fase 2.
// Sostituisce la vecchia dashboard con un layout piu' asciutto e orientato
// all'azione: saluto + campo "Crea un post" + lista "Da fare" a tre livelli
// + colonna laterale "Questa settimana".

import type { Metadata } from "next";
import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { buildDashboardTasks, listTasks } from "@/modules/m12-daily-use/server";
import { listBrands } from "@/modules/m02-brand/public";
import { listContentDraftsByStatus } from "@/modules/m03-editorial/public";
import { HelpButton } from "@/components/help/help-button";
import { CreatePostField } from "@/components/oggi/create-post-field";
import { TodayTaskList } from "@/components/oggi/today-task-list";
import { ThisWeekCard } from "@/components/oggi/this-week-card";

export const metadata: Metadata = { title: "Oggi" };

function greetingFor(userEmail: string, now: Date): string {
 const h = now.getHours();
 const timePart = h < 13 ? "Buongiorno" : h < 19 ? "Buon pomeriggio" : "Buonasera";
 const name = userEmail.split("@")[0] ?? "";
 const nameCap = name.length > 0 ? name.charAt(0).toUpperCase() + name.slice(1) : "";
 return nameCap ? `${timePart}, ${nameCap}` : timePart;
}

function formatToday(d: Date): string {
 return d.toLocaleDateString("it-IT", {
 weekday: "long",
 day: "numeric",
 month: "long",
 });
}

function estimateMinutes(totalTasks: number): number {
 // Stima grezza: 4 minuti a task (lettura + decisione + azione rapida).
 return Math.max(5, totalTasks * 4);
}

export default async function OggiPage() {
 const session = await getSessionOrRedirect();

 const [tasks, customTasks, brands, approvedDrafts, scheduledDrafts] = await Promise.all([
 buildDashboardTasks(session.organizationId),
 listTasks({ organizationId: session.organizationId, status: "all", limit: 50 }),
 listBrands(session.organizationId, "active"),
 listContentDraftsByStatus(session.organizationId, "approved", 20),
 listContentDraftsByStatus(session.organizationId, "scheduled", 20),
 ]);

 const openCustomTasks = customTasks.filter((t) => t.status === "open");
 const totalCount = tasks.totalCount + openCustomTasks.length;
 const now = new Date();
 const greeting = greetingFor(session.userId, now);
 const today = formatToday(now);
 const mins = estimateMinutes(totalCount);

 // "Questa settimana": scheduled nei prossimi 7gg.
 const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
 const thisWeek = scheduledDrafts.filter((d) => {
 if (!d.scheduledAt) return false;
 const when = new Date(d.scheduledAt);
 return when >= now && when <= in7;
 });

 return (
 <div className="space-y-6">
 {/* Saluto + riepilogo */}
 <header className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <h1
 className="text-3xl font-extrabold uppercase tracking-tight text-text"
 style={{ fontFamily: "var(--font-bricolage)" }}
 >
 {greeting}
 </h1>
 <p className="mt-1 text-sm text-text-muted">
 {today.charAt(0).toUpperCase() + today.slice(1)}.{" "}
 {totalCount > 0 ? (
 <>
 Hai <strong>{totalCount}</strong> cose da fare oggi, circa{" "}
 <strong>{mins}</strong> minuti.
 </>
 ) : (
 <>Nessun task urgente. Approfitta per pianificare la settimana.</>
 )}
 </p>
 </div>
 <HelpButton pageKey="dashboard" />
 </header>

 {/* Campo "Crea un post" */}
 <CreatePostField brands={brands.map((b) => ({ slug: b.slug, displayName: b.displayName }))} />

 {/* Griglia principale: Da fare a sinistra, Questa settimana a destra */}
 <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
 <div>
 <TodayTaskList tasks={tasks} customTasks={openCustomTasks} />
 </div>
 <div className="space-y-4">
 <ThisWeekCard
 scheduled={thisWeek.map((d) => ({
 id: d.id,
 brandSlug: d.brandSlug,
 brandDisplayName: d.brandDisplayName,
 brandColor: d.brandColor,
 themeInput: d.themeInput,
 scheduledAt: d.scheduledAt,
 }))}
 waitingForDate={approvedDrafts.length}
 />

 {/* Link rapidi ai flussi editoriali */}
 <div className="rounded-lg border border-border bg-surface p-4">
 <h3 className="mb-2 text-sm font-semibold text-text">Azioni rapide</h3>
 <div className="flex flex-col gap-2 text-sm">
 <Link href="/contenuti" className="text-primary hover:underline">
 Pianifica le prossime settimane →
 </Link>
 <Link href="/contenuti?status=draft" className="text-primary hover:underline">
 Vai alle bozze da approvare →
 </Link>
 <Link href="/contenuti/calendario" className="text-primary hover:underline">
 Apri il calendario editoriale →
 </Link>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
