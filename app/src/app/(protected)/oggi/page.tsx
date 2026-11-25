// Home "Oggi" — nuova dashboard asciutta, orientata all'azione:
// saluto + campo "Crea un post" + lista "Da fare" a tre livelli
// + colonna laterale "Questa settimana".

import type { Metadata } from "next";
import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { buildDashboardTasks, listTasks } from "@/modules/m12-daily-use/server";
import { listBrands } from "@/modules/m02-brand/public";
import { listContentDraftsByStatus } from "@/modules/m03-editorial/public";
import { HelpButton } from "@/components/help/help-button";
import { getBrandFilter, getBrandFilterId } from "@/lib/ui/brand-filter";
import { CreatePostField } from "@/components/oggi/create-post-field";
import { TodayTaskList } from "@/components/oggi/today-task-list";
import { ThisWeekCard } from "@/components/oggi/this-week-card";

export const metadata: Metadata = { title: "Oggi · Regìa" };

// UUID = 36 char con trattini in posizioni 8/13/18/23. Se compare nel
// greeting significa che non abbiamo recuperato l'email del profilo.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function greetingFor(userIdentifier: string, now: Date): string {
  const h = now.getHours();
  const timePart = h < 13 ? "Buongiorno" : h < 19 ? "Buon pomeriggio" : "Buonasera";
  const raw = (userIdentifier ?? "").trim();
  // Se è un UUID, non abbiamo il nome: usa il saluto senza nome invece di
  // mostrare la stringa "711CC123-...".
  if (!raw || UUID_RE.test(raw)) return timePart;
  // Prendi la parte prima della @ e il primo "token" (es. "mario.rossi" → "mario").
  const localPart = raw.split("@")[0] ?? raw;
  const firstToken = localPart.split(/[._-]/)[0] ?? localPart;
  const name = firstToken.length > 0 ? firstToken.charAt(0).toUpperCase() + firstToken.slice(1) : "";
  return name ? `${timePart}, ${name}` : timePart;
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
  // Email per il saluto (session espone solo userId UUID). Recuperiamo
  // dall'auth admin; fallback a stringa vuota (greeting senza nome).
  const admin = getAdminClient();
  const { data: userRow } = await admin.auth.admin.getUserById(session.userId);
  const userEmail = userRow.user?.email ?? "";

  // Filtro marchio globale (cookie regia_brand o ?marchio=): applica alle
  // aggregate "Da fare" e "Questa settimana". `null` = tutti i marchi.
  const currentBrandSlug = await getBrandFilter(null);
  const currentBrandId = (await getBrandFilterId(session.organizationId, null)) ?? undefined;

  const [tasks, customTasks, brands, approvedDrafts, scheduledDrafts] = await Promise.all([
    buildDashboardTasks(session.organizationId, currentBrandId),
    // operational_tasks sono org-level (niente brand_id): i task personali
    // dell'Owner restano visibili qualunque filtro marchio sia attivo.
    listTasks({ organizationId: session.organizationId, status: "all", limit: 50 }),
    listBrands(session.organizationId, "active"),
    listContentDraftsByStatus(session.organizationId, "approved", 20, currentBrandId),
    listContentDraftsByStatus(session.organizationId, "scheduled", 20, currentBrandId),
  ]);

  const openCustomTasks = customTasks.filter((t) => t.status === "open");
  const totalCount = tasks.totalCount + openCustomTasks.length;
  const now = new Date();
  const greeting = greetingFor(userEmail, now);
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
    // overflow-x-hidden evita lo scroll orizzontale di pochi px che la vecchia
    // Home mostrava su alcuni browser.
    <div className="space-y-6 overflow-x-hidden">
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
                Hai <strong>{totalCount}</strong> cose da fare oggi, circa <strong>{mins}</strong>{" "}
                minuti.
              </>
            ) : (
              <>Nessun task urgente. Approfitta per pianificare la settimana.</>
            )}
          </p>
        </div>
        <HelpButton pageKey="dashboard" />
      </header>

      {/* Campo "Crea un post" */}
      <CreatePostField
        brands={brands.map((b) => ({ slug: b.slug, displayName: b.displayName }))}
        currentBrand={currentBrandSlug}
      />

      {/* Griglia principale: Da fare a sinistra, Questa settimana a destra */}
      {/* min-w-0 sulle colonne per evitare che il contenuto interno (bottoni,
          titoli lunghi) forzi overflow orizzontale causando scroll di pochi px. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
