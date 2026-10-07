// RA-8.11 Memoria agente — pagina Owner-only.
// Mostra cosa l'AI ha "imparato" dall'uso: approval rate per topic, motivi
// di rifiuto frequenti, esiti promozioni, preferenze di stile per marchio.
//
// La memoria risiede nel DB (RNF-8): cambio di modello AI non la perde.
// Nessun dato scritto qui: tutto read-only dai sistemi esistenti.

import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  getApprovalStatsByTopic,
  getRecentRejections,
  extractRejectionThemes,
  getPromoOutcomes,
  getBrandStylePreferences,
} from "@/modules/m11-admin/public";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Target, Palette } from "lucide-react";
import { HelpButton } from "@/components/help/help-button";

const TOPIC_LABELS: Record<string, string> = {
  officina: "Officina",
  bar: "Bar",
  consegna: "Consegna",
  promozione: "Promozione",
  avviso: "Avviso",
  ricorrenza: "Ricorrenza",
  altro: "Altro",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AgentMemoryPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "agent_memory.read")) {
    return (
      <div className="p-8 text-sm text-text-muted">
        La memoria dell&apos;agente AI e&apos; una vista strategica accessibile solo al
        Proprietario.
      </div>
    );
  }

  const [approvalStats, recentRejections, promoOutcomes, brandStyles] = await Promise.all([
    getApprovalStatsByTopic(session.organizationId),
    getRecentRejections(session.organizationId, 50),
    getPromoOutcomes(session.organizationId),
    getBrandStylePreferences(session.organizationId),
  ]);
  const themes = extractRejectionThemes(recentRejections);

  const totalDrafts = approvalStats.reduce((s, a) => s + a.totalDrafts, 0);
  const totalApproved = approvalStats.reduce((s, a) => s + a.approved, 0);
  const globalApprovalRate = totalDrafts > 0 ? totalApproved / totalDrafts : 0;

  return (
    <main className="space-y-6 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <nav className="text-xs text-text-muted">
            <Link href="/impostazioni" className="underline">
              Impostazioni
            </Link>{" "}
            / Memoria agente
          </nav>
          <HelpButton pageKey="memoria-agente" />
        </div>
        <div className="mt-1 flex items-start gap-3">
          <Brain className="mt-1 h-7 w-7 text-primary" />
          <div>
            <h1 className="font-serif text-2xl font-bold">Memoria dell&apos;agente</h1>
            <p className="mt-1 text-sm text-text-muted">
              RA-8.11 · Cosa l&apos;agente ha imparato dall&apos;uso. Aggregato dai dati di lavoro
              (bozze, voucher, brand kit). Risiede nel DB di Regia (pgvector + Postgres),
              <strong> non nel modello AI</strong>: un cambio di modello non la perde.
            </p>
          </div>
        </div>
      </header>

      {/* SEZIONE 1 — Approval rate per topic (RA-8.3) */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          <h2 className="font-serif text-lg font-semibold">Tasso di approvazione per categoria</h2>
        </div>
        <p className="mb-4 text-sm text-text-muted">
          Ultimi 90 giorni. RA-8.3: quando una categoria arriva a 9/10 approvate senza modifica, il
          sistema propone il passaggio di livello di autonomia. Globalmente:{" "}
          <strong>{pct(globalApprovalRate)}</strong> ({totalApproved}/{totalDrafts} bozze).
        </p>
        {approvalStats.length === 0 ? (
          <p className="text-sm italic text-text-muted">Nessuna bozza negli ultimi 90 giorni.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-2">Categoria</th>
                <th className="p-2 text-right">Totale</th>
                <th className="p-2 text-right">Approvate</th>
                <th className="p-2 text-right">Rifiutate</th>
                <th className="p-2 text-right">Pending</th>
                <th className="p-2 text-right">Tasso</th>
              </tr>
            </thead>
            <tbody>
              {approvalStats.map((s) => {
                const label =
                  s.topicLabel === null ? "—" : (TOPIC_LABELS[s.topicLabel] ?? s.topicLabel);
                const highlight = s.totalDrafts >= 10 && s.approvalRate >= 0.9;
                return (
                  <tr key={s.topicLabel ?? "null"} className="border-b border-border/60">
                    <td className="p-2">
                      <strong>{label}</strong>
                      {highlight && (
                        <span className="ml-2 rounded bg-success/15 px-2 py-0.5 text-xs text-success">
                          Candidata L2
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">{s.totalDrafts}</td>
                    <td className="p-2 text-right text-success">{s.approved}</td>
                    <td className="p-2 text-right text-danger">{s.rejected}</td>
                    <td className="p-2 text-right text-text-muted">{s.pending}</td>
                    <td className="p-2 text-right font-semibold">{pct(s.approvalRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* SEZIONE 2 — Motivi di rifiuto frequenti */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h2 className="font-serif text-lg font-semibold">Motivi di rifiuto frequenti</h2>
        </div>
        <p className="mb-4 text-sm text-text-muted">
          Parole chiave estratte dai motivi di rifiuto negli ultimi 90gg. Se una parola ricorre,
          l&apos;AI non ha ancora imparato quel pattern — serve correggere il brand kit o aggiungere
          ai pilastri.
        </p>
        {themes.length === 0 ? (
          <p className="text-sm italic text-text-muted">
            Nessun motivo di rifiuto negli ultimi 90gg (o nessun rifiuto esplicito).
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {themes.map((t) => (
                <span
                  key={t.keyword}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900"
                  style={{ fontSize: `${Math.min(16, 11 + t.occurrences)}px` }}
                >
                  {t.keyword} <strong>({t.occurrences})</strong>
                </span>
              ))}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-text-muted">
                Ultimi {recentRejections.length} motivi integrali
              </summary>
              <ul className="mt-2 space-y-1">
                {recentRejections.map((r) => (
                  <li key={r.draftId} className="rounded border bg-surface-muted p-2 text-xs">
                    <strong>{r.brandDisplayName}</strong>
                    {r.topicLabel && (
                      <>
                        {" · "}
                        <em>{TOPIC_LABELS[r.topicLabel] ?? r.topicLabel}</em>
                      </>
                    )}
                    <> · {formatDate(r.rejectedAt)}</>
                    <div className="mt-1 text-text-muted">{r.reason}</div>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>

      {/* SEZIONE 3 — Esiti promozioni */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-lg font-semibold">Esiti promozioni (voucher)</h2>
        </div>
        <p className="mb-4 text-sm text-text-muted">
          Per ogni offerta: quanti voucher emessi vs riscattati. Un tasso di riscatto basso
          suggerisce che l&apos;offerta non e&apos; attrattiva, il canale sbagliato o la scadenza
          troppo stretta.
        </p>
        {promoOutcomes.length === 0 ? (
          <p className="text-sm italic text-text-muted">Nessun voucher emesso finora.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-2">Offerta</th>
                <th className="p-2">Marchio</th>
                <th className="p-2 text-right">Emessi</th>
                <th className="p-2 text-right">Riscattati</th>
                <th className="p-2 text-right">Scaduti</th>
                <th className="p-2 text-right">Annullati</th>
                <th className="p-2 text-right">Tasso riscatto</th>
              </tr>
            </thead>
            <tbody>
              {promoOutcomes.map((p) => {
                const lowRate = p.issued >= 10 && p.redemptionRate < 0.2;
                return (
                  <tr key={p.offerId} className="border-b border-border/60">
                    <td className="p-2">
                      <strong>{p.offerName}</strong>
                      {lowRate && <TrendingDown className="ml-2 inline h-3 w-3 text-danger" />}
                    </td>
                    <td className="p-2 text-xs text-text-muted">{p.brandDisplayName}</td>
                    <td className="p-2 text-right">{p.issued}</td>
                    <td className="p-2 text-right text-success">{p.redeemed}</td>
                    <td className="p-2 text-right text-amber-700">{p.expired}</td>
                    <td className="p-2 text-right text-text-muted">{p.cancelled}</td>
                    <td
                      className={`p-2 text-right font-semibold ${
                        p.redemptionRate >= 0.5
                          ? "text-success"
                          : p.redemptionRate >= 0.2
                            ? "text-amber-700"
                            : "text-danger"
                      }`}
                    >
                      {pct(p.redemptionRate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* SEZIONE 4 — Preferenze di stile per marchio */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-lg font-semibold">Preferenze di stile per marchio</h2>
        </div>
        <p className="mb-4 text-sm text-text-muted">
          Pilastri narrativi configurati con peso attuale + conteggio parole vietate / argomenti
          sensibili. Riflesso di cosa l&apos;AI deve ricordare in generazione per ciascun marchio.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {brandStyles.map((b) => (
            <div key={b.brandId} className="rounded border border-border bg-surface-muted p-3">
              <h3 className="font-serif font-semibold">{b.brandDisplayName}</h3>
              {b.pillars.length === 0 ? (
                <p className="mt-2 text-xs italic text-text-muted">Nessun pilastro configurato.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {b.pillars.map((p) => (
                    <li key={p.name} className="flex items-center gap-2 text-sm">
                      <div className="flex-1">
                        <strong>{p.name}</strong>
                      </div>
                      <div className="h-2 w-24 overflow-hidden rounded bg-border">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, p.weight * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-text-muted">
                        {pct(p.weight)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2 text-xs text-text-muted">
                <span>🚫 {b.forbiddenCount} parole vietate</span>
                <span>⚠ {b.sensitiveTopicsCount} argomenti sensibili</span>
              </div>
              <Link
                href={`/marchi/${b.brandId}`}
                className="mt-2 inline-block text-xs text-primary underline"
              >
                Modifica brand kit →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-muted p-4 text-xs text-text-muted">
        <strong>Dove vivono questi dati:</strong> content_drafts (approval + motivi rifiuto),
        vouchers + voucher_offers (esiti promo), brand_pillars + brand_forbidden_words +
        brand_sensitive_topics (preferenze stile). Nessun dato viene scritto qui — e&apos; una vista
        aggregata. RA-8.12: la tracciabilita&apos; del singolo evento sta nell&apos;audit log
        (/audit).
      </section>
    </main>
  );
}
