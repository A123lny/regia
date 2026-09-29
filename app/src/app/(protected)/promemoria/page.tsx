// M09 Promemoria — RF-6.22 motore promemoria automatici.

import { notFound } from "next/navigation";
import { BellRing, ClipboardCheck, XCircle, Calendar } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listReminders,
  getRemindersStats,
  REMINDER_KIND_LABELS,
} from "@/modules/m09-reminders/public";
import type { ReminderKind, ReminderStatus } from "@/modules/m09-reminders/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { RemindersClient } from "./reminders-client";

type SearchParams = { brand?: string; kind?: string; status?: string };

function isKind(s: string | undefined): s is ReminderKind {
  return (
    s === "welcome" ||
    s === "thanks_order" ||
    s === "service_call" ||
    s === "voucher_expiring" ||
    s === "counter_close" ||
    s === "dormant_reactivation" ||
    s === "review_request"
  );
}

function isStatus(s: string | undefined): s is ReminderStatus {
  return s === "pending" || s === "sent" || s === "dismissed" || s === "expired";
}

export default async function PromemoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "reminders.read")) notFound();

  const params = await searchParams;
  const brandFilter = params.brand ?? "";
  const kindFilter = isKind(params.kind) ? params.kind : undefined;
  const statusFilter: ReminderStatus = isStatus(params.status) ? params.status : "pending";

  const [brands, stats] = await Promise.all([
    listBrands(session.organizationId, "active"),
    getRemindersStats(session.organizationId),
  ]);
  const selectedBrand = brands.find((b) => b.slug === brandFilter);

  const listInput: Parameters<typeof listReminders>[0] = {
    organizationId: session.organizationId,
    status: statusFilter,
    limit: 500,
  };
  if (selectedBrand) listInput.brandId = selectedBrand.id;
  if (kindFilter) listInput.kind = kindFilter;

  const reminders = await listReminders(listInput);

  const canCrud = hasCapability(session.role, "reminders.crud");
  const canRefresh = hasCapability(session.role, "reminders.refresh");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BellRing className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Promemoria
            </h1>
          </div>
          <HelpButton pageKey="promemoria" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Motore retention RF-6.22: benvenuto, richiami officina data certa, voucher in scadenza,
          contatori vicini alla soglia, riattivazione dormienti. Spesso più redditizi delle
          promozioni.
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
            <BellRing className="h-3.5 w-3.5" /> Da fare oggi
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.pendingToday}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Calendar className="h-3.5 w-3.5" /> Prossimi 7 giorni
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.pendingWeek}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <ClipboardCheck className="h-3.5 w-3.5" /> Inviati 30gg
          </div>
          <div
            className="mt-1 text-3xl font-bold text-success"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.sentLast30d}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <XCircle className="h-3.5 w-3.5" /> Ignorati 30gg
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text-muted"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.dismissedLast30d}
          </div>
        </div>
      </div>

      {/* Filtri form (GET) */}
      <form method="get" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Marchio
            </span>
            <select
              name="brand"
              defaultValue={brandFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Tipo
            </span>
            <select
              name="kind"
              defaultValue={kindFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutti</option>
              {(Object.keys(REMINDER_KIND_LABELS) as ReminderKind[]).map((k) => (
                <option key={k} value={k}>
                  {REMINDER_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Stato
            </span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="pending">Da fare</option>
              <option value="sent">Inviati</option>
              <option value="dismissed">Ignorati</option>
              <option value="expired">Scaduti</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-text-muted">
            <strong>{reminders.length}</strong> risultat{reminders.length === 1 ? "o" : "i"}
          </p>
          <div className="flex gap-2">
            <a
              href="/promemoria"
              className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted"
            >
              Reset
            </a>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
            >
              Filtra
            </button>
          </div>
        </div>
      </form>

      <RemindersClient reminders={reminders} canCrud={canCrud} canRefresh={canRefresh} />

      {reminders.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun promemoria con questi filtri.
          {statusFilter === "pending" && canRefresh && (
            <>
              <br />
              Prova a <strong>Ricalcolare i promemoria</strong> per generare quelli automatici.
            </>
          )}
        </div>
      )}
    </div>
  );
}
