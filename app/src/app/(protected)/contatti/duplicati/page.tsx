// RF-1.7 · pagina duplicati contatti.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users2, Mail, Phone, MessageSquare } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { findDuplicateGroups } from "@/modules/m01-data-hub/public";
import { HelpButton } from "@/components/help/help-button";
import { DuplicatesClient } from "./duplicates-client";

export default async function DuplicatiPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "contacts.dedup.read")) notFound();

  const groups = await findDuplicateGroups(session.organizationId);
  const canMerge = hasCapability(session.role, "contacts.dedup.merge");

  const emailGroups = groups.filter((g) => g.matchKind === "email").length;
  const phoneGroups = groups.filter((g) => g.matchKind === "phone").length;
  const whatsappGroups = groups.filter((g) => g.matchKind === "whatsapp").length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/contatti"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contatti
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users2 className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Duplicati
            </h1>
          </div>
          <HelpButton pageKey="contatti-duplicati" />
        </div>
        <p className="text-sm text-text-muted">
          RF-1.7 pulizia liste: gruppi di contatti che condividono email/telefono/WhatsApp
          normalizzati. La fusione è distruttiva (solo Owner) e migra consensi, ordini, voucher,
          veicoli, eventi.
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Mail className="h-3.5 w-3.5" /> Email
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {emailGroups}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Phone className="h-3.5 w-3.5" /> Telefono
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {phoneGroups}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {whatsappGroups}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun duplicato rilevato. La base contatti è pulita.
        </div>
      ) : (
        <DuplicatesClient groups={groups} canMerge={canMerge} />
      )}
    </div>
  );
}
