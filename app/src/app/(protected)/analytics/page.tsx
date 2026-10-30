// M08 Analytics — cruscotto commerciale cross-modulo (RF-8.x).

import { notFound } from "next/navigation";
import {
  BarChart3,
  Users,
  ShoppingBag,
  Gift,
  Megaphone,
  UtensilsCrossed,
  QrCode,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  getContactsAnalytics,
  getOrdersAnalytics,
  getLoyaltyAnalytics,
  getOutreachAnalytics,
  getPartnersAnalytics,
  getSignupAnalytics,
  getAttributionByDraft,
  getCrossBrandFlow,
  PERIOD_LABELS,
} from "@/modules/m08-analytics/public";
import type { AnalyticsPeriod } from "@/modules/m08-analytics/public";
import { HelpButton } from "@/components/help/help-button";
import {
  formatCents,
  CONTACT_SOURCE_LABELS,
  CONSENT_CHANNEL_LABELS,
} from "@/modules/m01-data-hub/public";
import { ORDER_CHANNEL_LABELS } from "@/modules/m01-data-hub/public";
import { ONBOARDING_STATUS_LABELS } from "@/modules/m07-partners/public";
import { CAMPAIGN_CHANNEL_LABELS } from "@/modules/m07-outreach/public";
import type { OnboardingStatus } from "@/modules/m07-partners/public";
import type { CampaignChannel } from "@/modules/m07-outreach/public";
import type { ContactSource, ConsentChannel, OrderChannel } from "@/modules/m01-data-hub/public";

type SearchParams = { period?: string };

function isPeriod(s: string | undefined): s is AnalyticsPeriod {
  return s === "7d" || s === "30d" || s === "90d";
}

function pctDelta(
  current: number,
  previous: number,
): { pct: number; direction: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { pct: 0, direction: "flat" };
  if (previous === 0) return { pct: 100, direction: "up" };
  const delta = ((current - previous) / previous) * 100;
  const pct = Math.round(Math.abs(delta));
  if (Math.abs(delta) < 1) return { pct, direction: "flat" };
  return { pct, direction: delta > 0 ? "up" : "down" };
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const d = pctDelta(current, previous);
  const Icon = d.direction === "up" ? TrendingUp : d.direction === "down" ? TrendingDown : Minus;
  const cls =
    d.direction === "up"
      ? "text-success"
      : d.direction === "down"
        ? "text-danger"
        : "text-text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {d.direction === "flat" ? "stabile" : `${d.pct}%`}
    </span>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "analytics.read")) notFound();

  // RU-1a: dati commerciali (fatturato in euro, esiti promo monetari) solo Owner.
  // L'Editor accede alla pagina ma vede un placeholder al posto di queste sezioni.
  const canCommercial = hasCapability(session.role, "analytics.commercial.read");

  const params = await searchParams;
  const period: AnalyticsPeriod = isPeriod(params.period) ? params.period : "30d";

  const [contacts, orders, loyalty, outreach, partners, signup, attribution, crossBrand] =
    await Promise.all([
      getContactsAnalytics(session.organizationId, period),
      getOrdersAnalytics(session.organizationId, period),
      getLoyaltyAnalytics(session.organizationId),
      getOutreachAnalytics(session.organizationId),
      getPartnersAnalytics(session.organizationId),
      getSignupAnalytics(session.organizationId, period),
      getAttributionByDraft(session.organizationId, { limit: 20 }),
      // RF-6.9: commercial-only (RU-1a) ma lo chiamiamo sempre per semplicità;
      // mostriamo la sezione solo se canCommercial. Costo trascurabile (poche righe voucher).
      getCrossBrandFlow(session.organizationId, period),
    ]);

  // Massimo per bar chart CSS
  const maxOrderChannel = Math.max(1, ...orders.byChannel.map((c) => c.totalCents));

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Analytics
            </h1>
          </div>
          <HelpButton pageKey="analytics" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Vista aggregata cross-modulo. Contatti, vendite, fedeltà, ristoranti, iscrizioni.
        </p>
      </header>

      {/* Period selector */}
      <div className="flex gap-2">
        {(Object.keys(PERIOD_LABELS) as AnalyticsPeriod[]).map((p) => (
          <a
            key={p}
            href={`/analytics?period=${p}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-text-muted hover:border-primary/40"
            }`}
          >
            {PERIOD_LABELS[p]}
          </a>
        ))}
      </div>

      {/* ============ CONTATTI ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Contatti
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Attivi</div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {contacts.totalActive}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
              Nuovi periodo
              <TrendBadge current={contacts.newInPeriod} previous={contacts.newPreviousPeriod} />
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {contacts.newInPeriod}
            </div>
            <div className="text-[11px] text-text-muted">
              vs {contacts.newPreviousPeriod} periodo prec.
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Archiviati</div>
            <div className="mt-1 text-2xl font-bold text-text-muted">{contacts.totalArchived}</div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Fonti attive</div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {contacts.bySource.length}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Consensi per canale */}
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">
              Consensi per canale (RF-1.4)
            </h3>
            <div className="space-y-2">
              {contacts.consentsByChannel.map((c) => {
                const total = c.granted + c.revoked + c.never;
                const grantedPct = total > 0 ? (c.granted / total) * 100 : 0;
                return (
                  <div key={c.channel}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-text">
                        {CONSENT_CHANNEL_LABELS[c.channel as ConsentChannel] ?? c.channel}
                      </span>
                      <span className="text-text-muted">
                        <strong className="text-success">{c.granted}</strong> attivi · {c.revoked}{" "}
                        rev · {c.never} mai
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full bg-success transition-all"
                        style={{ width: `${grantedPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribuzione fonti */}
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">Fonti</h3>
            <div className="space-y-1.5">
              {contacts.bySource.length === 0 ? (
                <p className="text-xs text-text-muted italic">Nessun dato</p>
              ) : (
                contacts.bySource.map((s) => {
                  const total = contacts.bySource.reduce((sum, x) => sum + x.count, 0);
                  const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <div key={s.source} className="flex items-center justify-between text-xs">
                      <span className="text-text">
                        {CONTACT_SOURCE_LABELS[s.source as ContactSource] ?? s.source}
                      </span>
                      <span className="font-medium text-text-muted">
                        {s.count} <span className="text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ ORDINI ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Ordini
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Ordini periodo
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {orders.countInPeriod}
            </div>
          </div>
          {canCommercial ? (
            <>
              <div className="rounded-lg bg-bg p-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
                  Fatturato
                  <TrendBadge
                    current={orders.totalCentsInPeriod}
                    previous={orders.totalCentsPreviousPeriod}
                  />
                </div>
                <div
                  className="mt-1 text-2xl font-bold text-text"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  {formatCents(orders.totalCentsInPeriod)}
                </div>
                <div className="text-[11px] text-text-muted">
                  vs {formatCents(orders.totalCentsPreviousPeriod)}
                </div>
              </div>
              <div className="rounded-lg bg-bg p-3">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">
                  Scontrino medio
                </div>
                <div
                  className="mt-1 text-2xl font-bold text-text"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  {formatCents(orders.avgOrderValueCents)}
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-2 flex items-center justify-center rounded-lg border border-dashed border-border bg-bg p-3 text-center text-[11px] italic text-text-muted">
              Dati di fatturato riservati al titolare (RU-1a)
            </div>
          )}
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Canali attivi
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {orders.byChannel.length}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">
            {canCommercial ? "Fatturato per canale" : "Ordini per canale"}
          </h3>
          {orders.byChannel.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nessun ordine nel periodo</p>
          ) : (
            <div className="space-y-2">
              {orders.byChannel.map((c) => {
                const pct = (c.totalCents / maxOrderChannel) * 100;
                return (
                  <div key={c.channel}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-text">
                        {ORDER_CHANNEL_LABELS[c.channel as OrderChannel] ?? c.channel}
                      </span>
                      <span className="text-text-muted">
                        {c.count} ord
                        {canCommercial && (
                          <>
                            {" "}
                            · <strong className="text-text">{formatCents(c.totalCents)}</strong>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============ FEDELTÀ ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Fedeltà + voucher
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Voucher attivi
            </div>
            <div
              className="mt-1 text-2xl font-bold text-primary"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {loyalty.vouchersActive}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Riscattati</div>
            <div
              className="mt-1 text-2xl font-bold text-success"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {loyalty.vouchersRedeemed}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Tasso riscatto
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {loyalty.redemptionRatePct}%
            </div>
          </div>
          <div
            className={`rounded-lg p-3 ${loyalty.expiringNext7d > 0 ? "bg-warning/10" : "bg-bg"}`}
          >
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              In scadenza 7gg
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {loyalty.expiringNext7d}
            </div>
          </div>
        </div>

        {loyalty.topProgressingContacts.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">
              Vicini alla soglia (top 5)
            </h3>
            <div className="space-y-2">
              {loyalty.topProgressingContacts.map((p, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-text">
                      {p.contactFullName ?? "(senza nome)"}
                    </span>
                    <span className="text-text-muted">
                      <strong className="text-text">
                        {p.progress}/{p.threshold}
                      </strong>{" "}
                      · {p.counterName}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${p.percentComplete}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ SEGMENTI + CAMPAGNE ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Segmenti + campagne
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Segmenti attivi
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {outreach.activeSegments}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Contatti segmentati
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {outreach.totalSegmentedContacts}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Draft</div>
            <div className="mt-1 text-xl font-bold text-text-muted">{outreach.campaignsDraft}</div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Programmate</div>
            <div className="mt-1 text-xl font-bold text-primary">{outreach.campaignsScheduled}</div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Inviate</div>
            <div className="mt-1 text-xl font-bold text-success">{outreach.campaignsSent}</div>
          </div>
        </div>

        {outreach.lastCampaignSent && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="text-xs uppercase tracking-wider text-text-muted">
              Ultima campagna inviata
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="font-medium text-text">{outreach.lastCampaignSent.name}</span>
              <span className="text-xs text-text-muted">
                {CAMPAIGN_CHANNEL_LABELS[outreach.lastCampaignSent.channel as CampaignChannel] ??
                  outreach.lastCampaignSent.channel}
              </span>
              <span className="text-xs text-text-muted">
                {new Date(outreach.lastCampaignSent.sentAt).toLocaleDateString("it-IT")}
              </span>
            </div>
            <div className="mt-1 text-sm">
              <strong className="text-success">{outreach.lastCampaignSent.delivered}</strong>/
              {outreach.lastCampaignSent.attempted} consegnati
              {outreach.lastCampaignSent.failed > 0 && (
                <span className="ml-2 text-danger">
                  · {outreach.lastCampaignSent.failed} falliti
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ============ RISTORANTI LENNY ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Rete ristoranti Lenny
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Attivi</div>
            <div
              className="mt-1 text-2xl font-bold text-success"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {partners.totalActive}
            </div>
          </div>
          <div className={`rounded-lg p-3 ${partners.cooling > 0 ? "bg-warning/10" : "bg-bg"}`}>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              In raffreddamento
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {partners.cooling}
            </div>
            <div className="text-[11px] text-text-muted">priorità RF-7.4</div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Da contattare
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {partners.toContact}
            </div>
            <div className="text-[11px] text-text-muted">&gt;30gg</div>
          </div>
        </div>

        {partners.byStatus.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <h3 className="mb-1 text-xs uppercase tracking-wider text-text-muted">
              Distribuzione status
            </h3>
            {partners.byStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-xs">
                <span className="text-text">
                  {ONBOARDING_STATUS_LABELS[s.status as OnboardingStatus] ?? s.status}
                </span>
                <span className="font-medium text-text-muted">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ ISCRIZIONI LANDING ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Iscrizioni da landing
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-bg p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted">
              Signup periodo
              <TrendBadge
                current={signup.totalEventsInPeriod}
                previous={signup.totalEventsPreviousPeriod}
              />
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {signup.totalEventsInPeriod}
            </div>
            <div className="text-[11px] text-text-muted">
              vs {signup.totalEventsPreviousPeriod} periodo prec.
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Voucher benvenuto
            </div>
            <div
              className="mt-1 text-2xl font-bold text-success"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {signup.vouchersEmitted}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Landing con signup
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {signup.byLanding.length}
            </div>
          </div>
        </div>

        {signup.byLanding.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">
              Leaderboard landing
            </h3>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-bg text-left text-text-muted">
                  <tr>
                    <th className="p-2">Slug</th>
                    <th className="p-2">Titolo</th>
                    <th className="w-16 p-2 text-right">Signup</th>
                    <th className="w-20 p-2 text-right">Voucher</th>
                    <th className="w-20 p-2 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {signup.byLanding.map((l) => (
                    <tr key={l.slug} className="border-b border-border/40 last:border-0">
                      <td className="p-2">
                        <code className="rounded bg-surface-muted px-1 py-0.5">/{l.slug}</code>
                      </td>
                      <td className="p-2 text-text">{l.headline}</td>
                      <td className="p-2 text-right font-medium text-text">{l.signups}</td>
                      <td className="p-2 text-right text-success">{l.vouchersEmitted}</td>
                      <td className="p-2 text-right font-medium text-text-muted">
                        {l.conversionPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ============ RF-6.9 CROSS-BRAND FLOW ("PAGA CHI RICEVE") ============ */}
      {canCommercial && crossBrand.flows.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <h2
              className="text-lg font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Flusso cross-brand (RF-6.9)
            </h2>
          </div>
          <p className="mb-4 text-sm text-text-muted">
            Il valore scorre tra marchi: paga chi riceve il nuovo cliente. Per ogni coppia emittente
            → spendibile, mostriamo quanti voucher sono stati emessi, riscattati, e il costo stimato
            in euro a carico dello spendibile.
          </p>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-bg p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                Emessi cross-brand
              </div>
              <div
                className="mt-1 text-2xl font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {crossBrand.totalIssuedCrossBrand}
              </div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                Riscattati cross-brand
              </div>
              <div
                className="mt-1 text-2xl font-bold text-success"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {crossBrand.totalRedeemedCrossBrand}
              </div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                Costo stimato totale
              </div>
              <div
                className="mt-1 text-2xl font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {formatCents(crossBrand.totalEstimatedCostCents)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-2 pr-3">Emittente</th>
                  <th className="pr-3">→</th>
                  <th className="pr-3">Spendibile (paga)</th>
                  <th className="pr-3 text-right">Emessi</th>
                  <th className="pr-3 text-right">Riscattati</th>
                  <th className="pr-3 text-right">Scaduti</th>
                  <th className="pr-3 text-right">Clienti unici</th>
                  <th className="pr-3 text-right">Costo stimato</th>
                </tr>
              </thead>
              <tbody>
                {crossBrand.flows.map((f) => (
                  <tr
                    key={`${f.issuerBrandId}:${f.spendableBrandId}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2 pr-3 font-medium text-text">{f.issuerBrandName}</td>
                    <td className="pr-3 text-text-muted">→</td>
                    <td className="pr-3 font-medium text-text">{f.spendableBrandName}</td>
                    <td className="pr-3 text-right">{f.vouchersIssued}</td>
                    <td className="pr-3 text-right text-success">{f.vouchersRedeemed}</td>
                    <td className="pr-3 text-right text-text-muted">{f.vouchersExpired}</td>
                    <td className="pr-3 text-right">{f.distinctContactsRedeemed}</td>
                    <td className="pr-3 text-right font-medium">
                      {formatCents(f.estimatedCostCentsRedeemed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs italic text-text-muted">
            Nota: i voucher &ldquo;servizio gratis&rdquo; non entrano nel costo stimato; i voucher
            percentuali sono stimati sul totale dell&apos;ordine di riscatto quando disponibile.
          </p>
        </section>
      )}

      {/* ============ RF-9.3 ATTRIBUZIONE CONTENUTO -> VENDITA ============ */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h2
            className="text-lg font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Attribuzione contenuto → vendita
          </h2>
        </div>
        <p className="mb-4 text-sm text-text-muted">
          RF-9.3: voucher emessi con riferimento a un post (campo{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">source_draft_id</code>
          ). Chi emette dal banco o automaticamente dal signup non ha attribuzione:
          <strong> {attribution.attributionCoveragePct}%</strong> dei voucher sono tracciati fino al
          contenuto di origine.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Emessi attribuiti
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {attribution.totalIssuedAttributed}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Riscattati attribuiti
            </div>
            <div
              className="mt-1 text-2xl font-bold text-success"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {attribution.totalRedeemedAttributed}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Non attribuiti
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text-muted"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {attribution.totalIssuedUnattributed}
            </div>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Copertura attribuzione
            </div>
            <div
              className="mt-1 text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {attribution.attributionCoveragePct}%
            </div>
          </div>
        </div>

        {attribution.byDraft.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-bg p-6 text-center text-sm italic text-text-muted">
            Nessun voucher ancora attribuito a un contenuto. Quando emetti un voucher da{" "}
            <a href="/fedelta" className="underline">
              /fedelta
            </a>{" "}
            puoi indicare da quale post arriva: comparira&apos; qui con tasso di riscatto.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-bg text-left text-text-muted">
                <tr>
                  <th className="p-2">Post di origine</th>
                  <th className="w-28 p-2">Marchio</th>
                  <th className="w-20 p-2">Argomento</th>
                  <th className="w-16 p-2 text-right">Emessi</th>
                  <th className="w-20 p-2 text-right">Riscattati</th>
                  <th className="w-16 p-2 text-right">Scaduti</th>
                  <th className="w-20 p-2 text-right">Tasso</th>
                </tr>
              </thead>
              <tbody>
                {attribution.byDraft.map((d) => (
                  <tr key={d.draftId} className="border-b border-border/40 last:border-0">
                    <td className="p-2 text-text">
                      <strong>{d.draftTitle}</strong>
                      {d.firstIssuedAt && (
                        <div className="text-[10px] text-text-muted">
                          dal{" "}
                          {new Date(d.firstIssuedAt).toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-text-muted">{d.brandDisplayName}</td>
                    <td className="p-2 text-text-muted">
                      {d.topicLabel ?? <span className="italic">—</span>}
                    </td>
                    <td className="p-2 text-right font-medium text-text">{d.totalIssued}</td>
                    <td className="p-2 text-right text-success">{d.totalRedeemed}</td>
                    <td className="p-2 text-right text-amber-700">{d.totalExpired}</td>
                    <td
                      className={`p-2 text-right font-semibold ${
                        d.redemptionRatePct >= 50
                          ? "text-success"
                          : d.redemptionRatePct >= 20
                            ? "text-amber-700"
                            : "text-danger"
                      }`}
                    >
                      {d.redemptionRatePct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
