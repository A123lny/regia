// RF-12.6 Delega assenza titolare — banner "bentornato" quando Owner torna
// dopo N giorni di assenza. Propone di considerare la delega a un editor.

import Link from "next/link";
import { UserPlus, X as XIcon } from "lucide-react";

type Props = {
  previousLoginAt: string | null;
  role: string;
  pendingDraftsCount: number;
};

const ABSENCE_THRESHOLD_DAYS = 7;

function computeDaysAway(previousLoginAt: string): number {
  return Math.floor((Date.now() - new Date(previousLoginAt).getTime()) / (1000 * 60 * 60 * 24));
}

export function WelcomeBackBanner({ previousLoginAt, role, pendingDraftsCount }: Props) {
  if (!previousLoginAt) return null;
  const daysAway = computeDaysAway(previousLoginAt);
  if (daysAway < ABSENCE_THRESHOLD_DAYS) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="text-sm font-medium text-text">
          Bentornato! Sei stato via{" "}
          <strong>
            {daysAway} giorn{daysAway === 1 ? "o" : "i"}
          </strong>
          .
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {pendingDraftsCount > 0 ? (
            <>
              In questo periodo si sono accumulate{" "}
              <Link
                href="/contenuti/sessione"
                className="font-medium text-primary underline hover:no-underline"
              >
                {pendingDraftsCount} bozze da approvare
              </Link>
              .{" "}
            </>
          ) : null}
          {role === "owner" && (
            <>
              Se pensi di essere via a lungo, considera di{" "}
              <Link href="/team" className="font-medium text-primary underline hover:no-underline">
                assegnare un Editor
              </Link>{" "}
              che approvi al tuo posto (RF-12.6).
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-text-muted hover:bg-surface-muted"
        aria-label="Chiudi (verra rimostrato al prossimo accesso dopo assenza)"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
