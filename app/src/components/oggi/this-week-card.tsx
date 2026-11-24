// Colonna "Questa settimana" per la Home Oggi. Mostra i post programmati
// nei prossimi 7 giorni + CTA per distribuire le bozze approvate senza data.

import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";

type ScheduledItem = {
  id: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  themeInput: string;
  scheduledAt: string | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThisWeekCard({
  scheduled,
  waitingForDate,
}: {
  scheduled: ScheduledItem[];
  waitingForDate: number;
}) {
  const hasContent = scheduled.length > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
        <CalendarCheck2 className="h-4 w-4 text-primary" />
        Questa settimana
      </div>
      {hasContent ? (
        <ul className="space-y-2">
          {scheduled.slice(0, 6).map((item) => (
            <li key={item.id} className="space-y-1 border-b border-border/50 pb-2 last:border-0">
              <div className="flex items-center gap-2">
                <BrandChip
                  slug={item.brandSlug}
                  name={item.brandDisplayName}
                  color={item.brandColor}
                />
                <span className="text-[11px] text-text-muted">
                  {item.scheduledAt ? formatWhen(item.scheduledAt) : "—"}
                </span>
              </div>
              <Link
                href={`/contenuti/${item.brandSlug}/${item.id}`}
                className="block truncate text-sm text-text hover:text-primary"
              >
                {item.themeInput}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2 text-sm text-text-muted">
          <p>Nessun post programmato nei prossimi 7 giorni.</p>
          {waitingForDate > 0 && (
            <p>
              Hai <strong>{waitingForDate}</strong> post approvati che aspettano una data.{" "}
              <Link
                href="/contenuti?status=approved"
                className="text-primary hover:underline"
              >
                Distribuiscili →
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
