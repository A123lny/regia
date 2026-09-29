// Team management (RU-1a).
// Owner: modifica ruolo + archivia/ripristina membri.
// Editor: legge elenco team (team.read) ma nessuna azione.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import {
  hasCapability,
  ROLE_LABELS,
  CAPABILITY_LABELS,
  listCapabilities,
  type Role,
} from "@/lib/auth/permissions";
import { listTeamMembers } from "@/modules/m11-admin/public";
import { Badge } from "@/components/ui/badge";
import { TeamAdminClient } from "./team-admin-client";
import { HelpButton } from "@/components/help/help-button";

const ROLE_VARIANTS: Record<Role, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  delegate: "outline",
  agent: "outline",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "team.read")) notFound();
  const canManage = hasCapability(session.role, "team.manage");

  const { showArchived: showArchivedParam } = await searchParams;
  const showArchived = showArchivedParam === "1";
  const members = await listTeamMembers(
    session.organizationId,
    showArchived ? "archived" : "active",
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Team
          </h1>
          <HelpButton pageKey="team" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Membri dell&apos;organizzazione.{" "}
          {canManage
            ? "Puoi cambiare ruolo o archiviare un membro (owner-only)."
            : "Sola lettura: la gestione e riservata all&apos;Owner."}
        </p>
      </header>

      <TeamAdminClient
        members={members}
        canManage={canManage}
        showArchived={showArchived}
        currentUserId={session.userId}
      />

      {/* Matrice permessi documentata */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2
          className="mb-3 text-lg font-bold text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Cosa puo fare ogni ruolo
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(["owner", "editor"] as Role[]).map((r) => {
            const caps = listCapabilities(r);
            return (
              <div key={r} className="rounded-md border border-border bg-surface-muted/40 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={ROLE_VARIANTS[r]}>{ROLE_LABELS[r]}</Badge>
                  <span className="text-xs text-text-muted">{caps.length} capacita</span>
                </div>
                <ul className="space-y-0.5 text-xs text-text">
                  {caps.map((c) => (
                    <li key={c} className="flex items-start gap-1.5">
                      <span className="text-success">✓</span>
                      {CAPABILITY_LABELS[c]}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-muted/70">
          I ruoli <code>delegate</code> e <code>agent</code> sono predisposti nel DB ma non
          assegnabili via UI.
        </p>
        {canManage && (
          <p className="mt-3 text-xs text-text-muted">
            Per aggiungere un nuovo membro esegui{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5">
              bash scripts/dev-create-member.sh --email &lt;email&gt; --password &lt;pwd&gt;
            </code>{" "}
            (dev locale). UI di invito magic-link prevista in F1.6.
          </p>
        )}
        <p className="mt-2 text-xs text-text-muted">
          <Link href="/impostazioni" className="underline hover:text-primary">
            Vai alle impostazioni
          </Link>
        </p>
      </section>
    </div>
  );
}
