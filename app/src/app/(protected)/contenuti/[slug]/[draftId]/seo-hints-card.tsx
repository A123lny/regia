// RF-13.7 Suggerimenti SEO organica — card lato draft.
// Non client (nessun hook): puro Server Component che chiama l'analyzer deterministico.

import { CheckCircle2, Info, AlertTriangle, Lightbulb } from "lucide-react";
import { analyzeSeoHints, countBySeverity } from "@/modules/m03-editorial/public";
import type { SeoHint } from "@/modules/m03-editorial/public";

const ICON: Record<SeoHint["severity"], typeof CheckCircle2> = {
  good: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const COLOR: Record<SeoHint["severity"], string> = {
  good: "text-success",
  info: "text-text-muted",
  warning: "text-amber-600",
};

const BG: Record<SeoHint["severity"], string> = {
  good: "bg-success/5 border-success/20",
  info: "bg-surface-muted border-border",
  warning: "bg-amber-50 border-amber-200",
};

export function SeoHintsCard({ text }: { text: string }) {
  const hints = analyzeSeoHints(text);
  if (hints.length === 0) return null;
  const counts = countBySeverity(hints);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3
            className="text-sm font-medium text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Suggerimenti SEO
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          {counts.good > 0 && (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" />
              {counts.good}
            </span>
          )}
          {counts.warning > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {counts.warning}
            </span>
          )}
          {counts.info > 0 && (
            <span className="inline-flex items-center gap-1 text-text-muted">
              <Info className="h-3 w-3" />
              {counts.info}
            </span>
          )}
        </div>
      </div>
      <p className="mb-3 text-[11px] text-text-muted">
        RF-13.7 · analisi euristica (zero costo, zero AI). Checklist di qualita&apos;, non verdetto
        automatico — l&apos;Owner decide.
      </p>
      <ul className="space-y-2">
        {hints.map((h) => {
          const Icon = ICON[h.severity];
          return (
            <li
              key={h.key}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${BG[h.severity]}`}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${COLOR[h.severity]}`} />
              <div className="flex-1">
                <div className="font-medium text-text">{h.label}</div>
                <div className="mt-0.5 text-text-muted">{h.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
