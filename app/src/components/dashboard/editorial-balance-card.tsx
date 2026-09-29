// RF-12.3 Equilibrio editoriale — vista sintetica in dashboard.
// Mostra distribuzione contenuti approvati/programmati/pubblicati ultimi 30gg
// per topic_label (RF-12.2). Warning se sbilanciato ≥20 punti percentuali.

import { Scale, ArrowUp, ArrowDown } from "lucide-react";
import type { EditorialBalance } from "@/modules/m03-editorial/public";

export function EditorialBalanceCard({ balance }: { balance: EditorialBalance }) {
  if (balance.totalDrafts === 0) return null;

  const hasImbalance = balance.categories.some((c) => c.isImbalanced !== null);

  return (
    <section
      className={`rounded-2xl border p-5 ${
        hasImbalance ? "border-warning/30 bg-warning/5" : "border-border bg-surface"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Scale className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-text" style={{ fontFamily: "var(--font-bricolage)" }}>
          Equilibrio editoriale
        </h2>
        <span className="text-xs text-text-muted">
          ({balance.totalDrafts} contenuti · ultimi {balance.daysWindow}gg)
        </span>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        RF-12.3: distribuzione dei contenuti per etichetta di argomento (RF-12.2). Sbilancio
        segnalato se una categoria differisce dalla media di ±20 punti percentuali.
      </p>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {balance.categories.map((c) => (
          <div
            key={c.category}
            className={`rounded-md border p-3 ${
              c.isImbalanced === "over"
                ? "border-warning/40 bg-warning/10"
                : c.isImbalanced === "under"
                  ? "border-warning/40 bg-warning/10"
                  : "border-border bg-surface"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-text">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden="true"
                />
                {c.label}
              </span>
              <div className="flex items-center gap-1">
                {c.isImbalanced === "over" && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0 text-[10px] font-medium text-warning">
                    <ArrowUp className="h-2.5 w-2.5" /> troppo
                  </span>
                )}
                {c.isImbalanced === "under" && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0 text-[10px] font-medium text-warning">
                    <ArrowDown className="h-2.5 w-2.5" /> poco
                  </span>
                )}
                <span className="text-xs font-semibold text-text-muted">
                  {c.count} · {c.percent}%
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full transition-all ${c.isImbalanced ? "bg-warning" : "bg-primary"}`}
                style={{ width: `${Math.min(100, c.percent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
