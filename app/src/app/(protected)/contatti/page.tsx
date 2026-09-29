// M01 Data Hub — pagina Contatti cross-brand.
// RF-1.2 modello canonico, RF-1.4 registro consensi visibile per canale.

import { notFound } from "next/navigation";
import { Users, Mail, MessageSquare, Phone } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listContacts,
  getContactsStats,
  CONTACT_SOURCE_LABELS,
  CONSENT_CHANNEL_LABELS,
} from "@/modules/m01-data-hub/public";
import type { ContactSource, ConsentChannel, ConsentStatus } from "@/modules/m01-data-hub/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { ContactsAdminClient } from "./contacts-admin-client";

type SearchParams = {
  brand?: string;
  source?: string;
  consentChannel?: string;
  consentStatus?: string;
  q?: string;
  page?: string;
  showArchived?: string;
};

const PAGE_SIZE = 50;

function isSource(s: string | undefined): s is ContactSource {
  return s === "qr" || s === "manuale" || s === "import" || s === "gestionale" || s === "web";
}

function isConsentChannel(s: string | undefined): s is ConsentChannel {
  return s === "email" || s === "sms" || s === "whatsapp";
}

function isConsentStatus(s: string | undefined): s is ConsentStatus {
  return s === "granted" || s === "revoked" || s === "never";
}

export default async function ContattiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "contacts.read")) notFound();

  const params = await searchParams;
  const brandFilter = params.brand ?? "";
  const sourceFilter = isSource(params.source) ? params.source : undefined;
  const consentChannelFilter = isConsentChannel(params.consentChannel)
    ? params.consentChannel
    : undefined;
  const consentStatusFilter = isConsentStatus(params.consentStatus)
    ? params.consentStatus
    : undefined;
  const query = (params.q ?? "").trim();
  const showArchived = params.showArchived === "1";
  const page = Math.max(1, Number(params.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const [brands, stats] = await Promise.all([
    listBrands(session.organizationId, "active"),
    getContactsStats(session.organizationId),
  ]);
  const selectedBrand = brands.find((b) => b.slug === brandFilter);

  const listInput: Parameters<typeof listContacts>[0] = {
    organizationId: session.organizationId,
    limit: PAGE_SIZE,
    offset,
    includeArchived: showArchived,
  };
  if (selectedBrand) listInput.brandId = selectedBrand.id;
  if (sourceFilter) listInput.source = sourceFilter;
  if (query) listInput.query = query;
  if (consentChannelFilter && consentStatusFilter) {
    listInput.consentChannel = consentChannelFilter;
    listInput.consentStatus = consentStatusFilter;
  }
  const { items, totalCount } = await listContacts(listInput);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const canCrud = hasCapability(session.role, "contacts.crud");
  const canManageConsent = hasCapability(session.role, "contacts.consent.manage");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Contatti
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasCapability(session.role, "contacts.dedup.read") && (
              <a
                href="/contatti/duplicati"
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:border-primary/40"
              >
                Duplicati
              </a>
            )}
            <HelpButton pageKey="contatti" />
          </div>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Anagrafica canonica cross-marchio (RF-1.2) con consensi separati per canale (RF-1.4) e
          veicoli agganciati (RF-1.3). Il consenso è la condizione bloccante di ogni invio.
        </p>
      </header>

      {/* KPI riepilogo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Users className="h-3.5 w-3.5" /> Contatti attivi
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Mail className="h-3.5 w-3.5" /> Consenso email
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.withEmailConsent}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Phone className="h-3.5 w-3.5" /> Consenso SMS
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.withPhoneConsent}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <MessageSquare className="h-3.5 w-3.5" /> Consenso WhatsApp
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {stats.withWhatsappConsent}
          </div>
        </div>
      </div>

      {/* Filtri form (GET) */}
      <form method="get" className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Ricerca
            </span>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="nome, email, telefono..."
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            />
          </label>
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
              Fonte
            </span>
            <select
              name="source"
              defaultValue={sourceFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Tutte</option>
              {(Object.keys(CONTACT_SOURCE_LABELS) as ContactSource[]).map((s) => (
                <option key={s} value={s}>
                  {CONTACT_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Canale
              </span>
              <select
                name="consentChannel"
                defaultValue={consentChannelFilter ?? ""}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="">—</option>
                {(Object.keys(CONSENT_CHANNEL_LABELS) as ConsentChannel[]).map((c) => (
                  <option key={c} value={c}>
                    {CONSENT_CHANNEL_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Stato
              </span>
              <select
                name="consentStatus"
                defaultValue={consentStatusFilter ?? ""}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="">—</option>
                <option value="granted">Attivo</option>
                <option value="revoked">Disiscritto</option>
                <option value="never">Mai</option>
              </select>
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              name="showArchived"
              value="1"
              defaultChecked={showArchived}
              className="h-4 w-4 accent-primary"
            />
            Includi archiviati
          </label>
          <p className="text-xs text-text-muted">
            <strong>{totalCount}</strong> contatt{totalCount === 1 ? "o" : "i"}
          </p>
          <div className="flex gap-2">
            <a
              href="/contatti"
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

      {/* Lista + drawer via client component */}
      <ContactsAdminClient
        contacts={items}
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color,
        }))}
        canCrud={canCrud}
        canManageConsent={canManageConsent}
      />

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <a
              href={`?${new URLSearchParams({ ...(params as Record<string, string>), page: String(page - 1) }).toString()}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-text hover:border-primary/40"
            >
              ← Precedente
            </a>
          ) : (
            <span />
          )}
          <span className="text-text-muted">
            Pagina {page} di {totalPages}
          </span>
          {page < totalPages ? (
            <a
              href={`?${new URLSearchParams({ ...(params as Record<string, string>), page: String(page + 1) }).toString()}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-text hover:border-primary/40"
            >
              Successiva →
            </a>
          ) : (
            <span />
          )}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun contatto trovato. Usa &quot;Nuovo contatto&quot; per aggiungerne uno manualmente,
          oppure importa dal gestionale (RF-1.6, futuro).
        </div>
      )}
    </div>
  );
}
