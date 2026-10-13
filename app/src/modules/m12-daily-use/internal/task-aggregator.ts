// RF-12.1 Dashboard home — aggregatore task operativi.
// Raccoglie "cose da fare" da piu' moduli (m01, m03, m06, m07, m09, m13) e le
// classifica per priorita' in base a soglie fisse (capitolato §15.C taratura
// futura su dati veri). Il tutto in parallelo via Promise.all, best-effort:
// se una query fallisce la riga non appare, non si rompe il dashboard.

import { getAdminClient } from "@/lib/db/admin";

export type TaskPriority = "urgent" | "important" | "opportunity";

// Dettaglio singolo elemento che ha triggerato un segnale (es. un ristorante
// in cooling specifico, un contatto con segnale abbandono alta gravita').
// Mostrato nel SignalDetailSheet quando l'utente clicca sul task.
export type TaskDetailItem = {
  // id dell'entita' (partner_restaurant.id, abandonment_signal.id, etc.)
  entityId: string;
  // Nome principale mostrato: es. "La Dispensa"
  title: string;
  // Sottotitolo opzionale: es. "pizzeria · 47900"
  subtitle?: string;
  // Info descrittiva: motivo cooling / tipo segnale / etc.
  reason?: string;
  // Contatto rapido: telefono/email per rendere l'azione immediata
  phone?: string;
  // Metrica temporale: es. "15 giorni dall'ultimo contatto"
  secondaryInfo?: string;
  // Link al dettaglio nel modulo di riferimento (fallback se non c'e' azione)
  linkHref?: string;
};

export type TaskListItem = {
  id: string;
  priority: TaskPriority;
  iconName: string; // nome icona lucide-react, risolto in Client Component
  label: string;
  // Istruzione estesa mostrata nel SignalDetailSheet: cosa fare concretamente.
  instructions?: string;
  count: number;
  href: string;
  // Modulo/area responsabile, usato come fallback secondario e per filtri futuri.
  module: string;
  // Lista dettagliata degli elementi (es. ristoranti specifici in cooling).
  // Se presente, il click apre un drawer invece di navigare al modulo.
  items?: TaskDetailItem[];
  // Tipo del task per routing dell'azione contestuale (es. "cooling_partner"
  // -> bottone "Marca come contattato" che logga activity).
  actionKind?: "log_partner_contact";
};

export type DashboardTaskList = {
  urgent: TaskListItem[];
  important: TaskListItem[];
  opportunity: TaskListItem[];
  totalCount: number;
};

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export async function buildDashboardTasks(organizationId: string): Promise<DashboardTaskList> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const nowIso = new Date().toISOString();
  const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    abandonmentHigh,
    abandonmentMedium,
    overrunPending,
    draftsPending,
    remindersPending,
    vouchersExpiring,
    duplicateContacts,
    upcomingRecurrences,
    coolingPartners,
    deliveryErrorsAlarm,
    materialRequestsOpen,
    launchingPartners,
  ] = await Promise.all([
    // Segnali abbandono gravita' alta (urgent)
    safe(
      admin
        .from("abandonment_signals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("severity", "high")
        .is("resolved_at", null),
      { count: 0 },
    ),
    // Segnali abbandono gravita' media (opportunity)
    safe(
      admin
        .from("abandonment_signals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("severity", "medium")
        .is("resolved_at", null),
      { count: 0 },
    ),
    // Overrun advertising pending (urgent)
    safe(
      admin
        .from("advertising_overrun_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "pending"),
      { count: 0 },
    ),
    // Bozze da approvare (important)
    safe(
      admin
        .from("content_drafts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "draft"),
      { count: 0 },
    ),
    // Promemoria pending oggi (important)
    safe(
      admin
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .lte("scheduled_at", nowIso),
      { count: 0 },
    ),
    // Voucher in scadenza nei prossimi 10gg (important)
    safe(
      admin
        .from("vouchers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "issued")
        .gt("expires_at", nowIso)
        .lt("expires_at", in10Days),
      { count: 0 },
    ),
    // Contatti duplicati pending (important) — stima via query, dedup detector ha logica piu complessa
    safe(
      admin
        .from("contacts")
        .select("email")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .is("is_duplicate_of", null)
        .not("email", "is", null),
      { data: [] as { email: string }[] },
    ),
    // Ricorrenze in arrivo (opportunity)
    safe(
      admin
        .from("brand_recurring_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_active", true),
      { count: 0 },
    ),
    // Ristoranti cooling non contattati da 7gg (urgent) + dati completi per il
    // detail sheet (il count si deriva da data.length).
    safe(
      admin
        .from("partner_restaurants")
        .select("id, name, phone, cuisine_category, cooling_reason, last_contact_at, address_cap")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .eq("cooling_flag", true)
        .or(`last_contact_at.is.null,last_contact_at.lt.${sevenDaysAgo}`),
      {
        data: [] as Array<{
          id: string;
          name: string;
          phone: string | null;
          cuisine_category: string | null;
          cooling_reason: string | null;
          last_contact_at: string | null;
          address_cap: string | null;
        }>,
      },
    ),
    // Partner con errori consegna in allarme (>=3 ultimi 30gg) — urgent.
    // Query SQL inline: group by partner, count >= 3.
    safe(
      admin
        .from("partner_delivery_errors")
        .select("partner_id")
        .eq("organization_id", organizationId)
        .gte("occurred_at", thirtyDaysAgo),
      { data: [] as { partner_id: string }[] },
    ),
    // Material requests aperti (opportunity)
    safe(
      admin
        .from("content_material_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "open"),
      { count: 0 },
    ),
    // Ristoranti in fase di lancio (opportunity: sorveglianza 30gg)
    safe(
      admin
        .from("partner_restaurants")
        .select("id, launched_at")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .not("launched_at", "is", null),
      { data: [] as { id: string; launched_at: string }[] },
    ),
  ]);

  // Dedup contatti: conta email duplicate (semplificato)
  const emailMap = new Map<string, number>();
  for (const row of (duplicateContacts.data ?? []) as { email: string }[]) {
    const k = row.email.toLowerCase().trim();
    emailMap.set(k, (emailMap.get(k) ?? 0) + 1);
  }
  const duplicateGroups = Array.from(emailMap.values()).filter((n) => n >= 2).length;

  // Partner con allarme errori consegna
  const errorsByPartner = new Map<string, number>();
  for (const row of (deliveryErrorsAlarm.data ?? []) as { partner_id: string }[]) {
    errorsByPartner.set(row.partner_id, (errorsByPartner.get(row.partner_id) ?? 0) + 1);
  }
  const partnersInAlarm = Array.from(errorsByPartner.values()).filter((n) => n >= 3).length;

  // Partner in fase lancio (launched < 30gg fa)
  const launchWindowMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const partnersInLaunch = (
    (launchingPartners.data ?? []) as {
      launched_at: string;
    }[]
  ).filter((p) => now - new Date(p.launched_at).getTime() < launchWindowMs).length;

  // ────────────────────────────────────────────────────────────────────────
  // Composizione task list
  // ────────────────────────────────────────────────────────────────────────

  const urgent: TaskListItem[] = [];
  const important: TaskListItem[] = [];
  const opportunity: TaskListItem[] = [];

  const abandonmentHighCount = (abandonmentHigh as { count?: number }).count ?? 0;
  if (abandonmentHighCount > 0) {
    urgent.push({
      id: "abandonment-high",
      priority: "urgent",
      iconName: "AlertTriangle",
      label: `${abandonmentHighCount} segnal${abandonmentHighCount === 1 ? "e" : "i"} abbandono alta gravita`,
      count: abandonmentHighCount,
      href: "/anti-abbandono",
      module: "m09",
    });
  }

  const overrunCount = (overrunPending as { count?: number }).count ?? 0;
  if (overrunCount > 0) {
    urgent.push({
      id: "overrun-pending",
      priority: "urgent",
      iconName: "ShieldAlert",
      label: `${overrunCount} richiest${overrunCount === 1 ? "a" : "e"} sforamento budget da decidere`,
      count: overrunCount,
      href: "/governance/advertising",
      module: "m13",
    });
  }

  if (partnersInAlarm > 0) {
    urgent.push({
      id: "delivery-errors-alarm",
      priority: "urgent",
      iconName: "PackageX",
      label: `${partnersInAlarm} ristorant${partnersInAlarm === 1 ? "e" : "i"} in allarme errori consegna`,
      count: partnersInAlarm,
      href: "/ristoranti",
      module: "m07",
    });
  }

  // Ristoranti cooling: usiamo la lista completa (data) e costruiamo items[]
  // per rendere il task azionabile senza passare dalla pagina ristoranti.
  type CoolingRow = {
    id: string;
    name: string;
    phone: string | null;
    cuisine_category: string | null;
    cooling_reason: string | null;
    last_contact_at: string | null;
    address_cap: string | null;
  };
  const coolingRows = ((coolingPartners as { data?: CoolingRow[] }).data ?? []) as CoolingRow[];
  const coolingCount = coolingRows.length;
  if (coolingCount > 0) {
    const items: TaskDetailItem[] = coolingRows.map((r) => {
      const daysAgo =
        r.last_contact_at === null
          ? null
          : Math.floor(
              (Date.now() - new Date(r.last_contact_at).getTime()) / (1000 * 60 * 60 * 24),
            );
      const detail: TaskDetailItem = {
        entityId: r.id,
        title: r.name,
        linkHref: `/ristoranti?partner=${r.id}`,
      };
      const subtitleParts: string[] = [];
      if (r.cuisine_category) subtitleParts.push(r.cuisine_category);
      if (r.address_cap) subtitleParts.push(r.address_cap);
      if (subtitleParts.length > 0) detail.subtitle = subtitleParts.join(" · ");
      if (r.cooling_reason) detail.reason = r.cooling_reason;
      if (r.phone) detail.phone = r.phone;
      detail.secondaryInfo =
        daysAgo === null
          ? "mai contattato"
          : `${daysAgo} giorn${daysAgo === 1 ? "o" : "i"} dall'ultimo contatto`;
      return detail;
    });
    urgent.push({
      id: "cooling-partners",
      priority: "urgent",
      iconName: "PhoneOutgoing",
      label: `${coolingCount} ristorant${coolingCount === 1 ? "e" : "i"} in cooling da contattare`,
      instructions:
        "Sono partner in raffreddamento non contattati da 7+ giorni. Chiamali uno a uno: " +
        "quando parli con il referente usa 'Marca come contattato' per loggare la chiamata e " +
        "aggiornare l'ultimo contatto. Perdere un ristorante costa piu' di una promozione (RF-7.4).",
      count: coolingCount,
      href: "/ristoranti",
      module: "m07",
      items,
      actionKind: "log_partner_contact",
    });
  }

  const draftsCount = (draftsPending as { count?: number }).count ?? 0;
  if (draftsCount > 0) {
    important.push({
      id: "drafts-pending",
      priority: "important",
      iconName: "FileEdit",
      label: `${draftsCount} bozz${draftsCount === 1 ? "a" : "e"} da approvare`,
      count: draftsCount,
      href: "/contenuti/sessione",
      module: "m03",
    });
  }

  const remindersCount = (remindersPending as { count?: number }).count ?? 0;
  if (remindersCount > 0) {
    important.push({
      id: "reminders-today",
      priority: "important",
      iconName: "BellRing",
      label: `${remindersCount} promemoria da gestire oggi`,
      count: remindersCount,
      href: "/promemoria",
      module: "m09",
    });
  }

  const vouchersExpiringCount = (vouchersExpiring as { count?: number }).count ?? 0;
  if (vouchersExpiringCount > 0) {
    important.push({
      id: "vouchers-expiring",
      priority: "important",
      iconName: "Clock",
      label: `${vouchersExpiringCount} voucher in scadenza nei prossimi 10gg`,
      count: vouchersExpiringCount,
      href: "/fedelta",
      module: "m06",
    });
  }

  if (duplicateGroups > 0) {
    important.push({
      id: "duplicate-contacts",
      priority: "important",
      iconName: "Users",
      label: `${duplicateGroups} grupp${duplicateGroups === 1 ? "o" : "i"} di contatti duplicati`,
      count: duplicateGroups,
      href: "/contatti/duplicati",
      module: "m01",
    });
  }

  const abandonmentMediumCount = (abandonmentMedium as { count?: number }).count ?? 0;
  if (abandonmentMediumCount > 0) {
    opportunity.push({
      id: "abandonment-medium",
      priority: "opportunity",
      iconName: "AlertTriangle",
      label: `${abandonmentMediumCount} segnal${abandonmentMediumCount === 1 ? "e" : "i"} abbandono media gravita`,
      count: abandonmentMediumCount,
      href: "/anti-abbandono",
      module: "m09",
    });
  }

  const materialCount = (materialRequestsOpen as { count?: number }).count ?? 0;
  if (materialCount > 0) {
    opportunity.push({
      id: "material-requests",
      priority: "opportunity",
      iconName: "Camera",
      label: `${materialCount} richiest${materialCount === 1 ? "a" : "e"} materiali da raccogliere`,
      count: materialCount,
      href: "/contenuti",
      module: "m03",
    });
  }

  const recurrencesCount = (upcomingRecurrences as { count?: number }).count ?? 0;
  if (recurrencesCount > 0) {
    opportunity.push({
      id: "upcoming-recurrences",
      priority: "opportunity",
      iconName: "Calendar",
      label: `${recurrencesCount} ricorrenz${recurrencesCount === 1 ? "a" : "e"} annuali attive`,
      count: recurrencesCount,
      href: "/impostazioni/ricorrenze",
      module: "m03",
    });
  }

  if (partnersInLaunch > 0) {
    opportunity.push({
      id: "launching-partners",
      priority: "opportunity",
      iconName: "Rocket",
      label: `${partnersInLaunch} ristorant${partnersInLaunch === 1 ? "e" : "i"} in fase di lancio`,
      count: partnersInLaunch,
      href: "/ristoranti",
      module: "m07",
    });
  }

  return {
    urgent,
    important,
    opportunity,
    totalCount: urgent.length + important.length + opportunity.length,
  };
}
