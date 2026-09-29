// RF-3.6 Sessione di approvazione a doppia copertura.
// Wizard cross-brand che scorre tutte le bozze in stato 'draft' una alla volta.
// Opzionale: filtra per planBatchId per lavorare solo su un piano specifico.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listPendingDraftsForSession } from "@/modules/m03-editorial/public";
import { SessionWizardClient } from "./session-wizard-client";
import { HelpButton } from "@/components/help/help-button";

export default async function SessionePage({
  searchParams,
}: {
  searchParams: Promise<{ planBatchId?: string }>;
}) {
  const session = await getSessionOrRedirect();
  // La sessione approva bozze — serve capacity di approvazione (owner-only in matrice attuale)
  if (!hasCapability(session.role, "content.approve")) notFound();

  const { planBatchId } = await searchParams;
  const drafts = await listPendingDraftsForSession(
    session.organizationId,
    planBatchId ? { planBatchId } : undefined,
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Sessione di approvazione
            </h1>
          </div>
          <HelpButton pageKey="sessione" />
        </div>
        <p className="text-sm text-text-muted">
          Scorri le bozze una alla volta e decidi: approva, rifiuta (con motivo), o salta per
          rivederle poi. Copertura consigliata: 2 settimane (RF-3.6).
          {planBatchId && (
            <>
              {" "}
              Stai lavorando solo sulle bozze del piano appena generato.{" "}
              <Link href="/contenuti/sessione" className="underline hover:text-primary">
                Vedi tutte
              </Link>
            </>
          )}
        </p>
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-10 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-success" />
          <h2
            className="mb-2 text-xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {planBatchId ? "Piano interamente processato" : "Nessuna bozza in attesa"}
          </h2>
          <p className="text-sm text-text-muted">
            Tutte le bozze sono gia state approvate o rifiutate. Genera nuovo contenuto o pianifica.
          </p>
        </div>
      ) : (
        <SessionWizardClient initialDrafts={drafts} />
      )}
    </div>
  );
}
