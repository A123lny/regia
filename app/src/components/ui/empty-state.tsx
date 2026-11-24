// Stato vuoto standard Regìa (Fase 5 design system).
// Blocco centrato con icona opzionale, titolo, messaggio e un'azione CTA opzionale.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-text-muted">
          {icon}
        </div>
      )}
      <h3
        className="text-base font-semibold text-text"
        style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
      >
        {title}
      </h3>
      {message && <p className="mt-1 text-sm text-text-muted">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
