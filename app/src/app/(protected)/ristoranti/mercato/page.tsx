// RN-37/38/39 Analisi mercato per categoria — cruscotto strategico.
// Owner-only (partner.crud): decisione da gestore di mercato, non da marketing.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  UtensilsCrossed,
  AlertTriangle,
} from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { analyzeMarketByCategory } from "@/modules/m07-partners/public";
import type { MarketCategoryRow } from "@/modules/m07-partners/public";
import { HelpButton } from "@/components/help/help-button";

const POSITION_ICON: Record<MarketCategoryRow["position"], typeof TrendingUp> = {
  high: TrendingUp,
  in_line: Minus,
  low: TrendingDown,
};

const POSITION_COLOR: Record<MarketCategoryRow["position"], string> = {
  high: "text-success",
  in_line: "text-text-muted",
  low: "text-danger",
};

const REC_LABELS: Record<MarketCategoryRow["recommendation"], string> = {
  sotto_offerta: "Sotto-offerta",
  equilibrata: "Equilibrata",
  satura: "Satura",
  sconosciuta: "Dati insufficienti",
};

const REC_HINT: Record<MarketCategoryRow["recommendation"], string> = {
  sotto_offerta:
    "Pochi ristoranti rispetto alla domanda. Opportunita' per inserire un partner nuovo.",
  equilibrata: "Numero di partner adeguato alla domanda.",
  satura: "Molti ristoranti per la domanda. Nuovi partner avrebbero ordini sotto la media rete.",
  sconosciuta: "Mediana rete pari a 0: non si puo' confrontare.",
};

const REC_STYLE: Record<MarketCategoryRow["recommendation"], string> = {
  sotto_offerta: "border-success/40 bg-success/15 text-success",
  equilibrata: "border-border bg-surface-muted text-text-muted",
  satura: "border-danger/40 bg-danger/15 text-danger",
  sconosciuta: "border-warning/40 bg-warning/15 text-warning",
};

export default async function MercatoPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "partner.crud")) notFound();

  const analysis = await analyzeMarketByCategory(session.organizationId);

  return (
    <main className="space-y-6 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <nav className="text-xs text-text-muted">
            <Link href="/ristoranti" className="inline-flex items-center gap-1 underline">
              <ArrowLeft className="h-3 w-3" />
              Ristoranti
            </Link>{" "}
            / Analisi mercato
          </nav>
          <HelpButton pageKey="ristoranti-mercato" />
        </div>
        <div className="mt-1 flex items-start gap-3">
          <BarChart3 className="mt-1 h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-bold">Analisi di mercato della rete</h1>
            <p className="mt-1 text-sm text-text-muted">
              RN-37/38/39 · Il problema non e&apos; chi va male, e&apos;{" "}
              <strong>quanti fanno la stessa cosa</strong>. Confronto per categoria vs mediana rete:
              categorie <strong>sature</strong> (pochi ordini medi), categorie{" "}
              <strong>sotto-offerta</strong> (molti ordini medi). Decisione da gestore di mercato,
              non da marketing.
            </p>
          </div>
        </div>
      </header>

      {/* KPI riepilogo */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">Ristoranti attivi</div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {analysis.totalPartners}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">Categorie</div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {analysis.totalCategories}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">Ordini 90gg</div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {analysis.totalOrders}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">Mediana ord/rist</div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {analysis.medianAvgOrdersPerPartner}
          </div>
          <div className="text-[10px] text-text-muted">benchmark rete</div>
        </div>
      </section>

      {/* Tabella categorie */}
      {analysis.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          <UtensilsCrossed className="mx-auto mb-2 h-6 w-6" />
          Nessun ristorante con categoria valorizzata. Compila <code>cuisine_category</code> nei
          profili ristorante per vedere l&apos;analisi.
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-3">Categoria</th>
                <th className="w-28 p-3 text-right">Ristoranti</th>
                <th className="w-28 p-3 text-right">Ordini 90gg</th>
                <th className="w-32 p-3 text-right">Media ord/rist</th>
                <th className="w-28 p-3 text-right">Tempo prep</th>
                <th className="w-24 p-3 text-right">Cooling</th>
                <th className="w-40 p-3">Valutazione</th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row) => {
                const PosIcon = POSITION_ICON[row.position];
                return (
                  <tr key={row.category} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-medium text-text">{row.category}</td>
                    <td className="p-3 text-right">{row.partnerCount}</td>
                    <td className="p-3 text-right text-text-muted">{row.totalOrdersLast90d}</td>
                    <td className="p-3 text-right">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <PosIcon className={`h-3.5 w-3.5 ${POSITION_COLOR[row.position]}`} />
                        {row.avgOrdersPerPartner}
                      </span>
                      <div className="text-[10px] text-text-muted">
                        vs {analysis.medianAvgOrdersPerPartner}
                      </div>
                    </td>
                    <td className="p-3 text-right text-xs text-text-muted">
                      {row.avgPrepMinutes !== null ? `${row.avgPrepMinutes} min` : "—"}
                    </td>
                    <td className="p-3 text-right text-xs">
                      {row.coolingCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          {row.coolingCount}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                          REC_STYLE[row.recommendation]
                        }`}
                      >
                        {REC_LABELS[row.recommendation]}
                      </span>
                      <div className="mt-1 text-[10px] italic text-text-muted">
                        {REC_HINT[row.recommendation]}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-border bg-surface-muted p-4 text-xs text-text-muted">
        <strong>Nota F1:</strong> l&apos;analisi usa <code>brand_orders.partner_restaurant_id</code>
        . Finche&apos; i connettori M1 reali non alimentano questo campo, molte categorie restano a
        0 ordini e il confronto non e&apos; significativo. Resta valido il conteggio ristoranti per
        categoria (saturazione cardinale).
      </section>
    </main>
  );
}
