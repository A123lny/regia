"use client";

// Team admin client: tabella membri + tab attivi/archiviati + menu azioni (owner-only).

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Pencil,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import {
  updateMemberRole,
  archiveMember,
  restoreMember,
  type TeamMember,
} from "@/modules/m11-admin/public";

const ROLE_VARIANTS: Record<Role, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  delegate: "outline",
  agent: "outline",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type Props = {
  members: TeamMember[];
  canManage: boolean;
  showArchived: boolean;
  currentUserId: string;
};

export function TeamAdminClient({ members, canManage, showArchived, currentUserId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleArchive(m: TeamMember) {
    setBusyId(m.userId);
    startTransition(async () => {
      try {
        await archiveMember(m.userId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore archiviazione");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleRestore(m: TeamMember) {
    setBusyId(m.userId);
    startTransition(async () => {
      try {
        await restoreMember(m.userId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore ripristino");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button
            type="button"
            onClick={() => setError(null)}
            className="underline"
            aria-label="Chiudi errore"
          >
            chiudi
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-xs">
        <Link
          href="/team"
          className={`rounded-md px-2.5 py-1 font-medium ${
            !showArchived ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-muted"
          }`}
        >
          Attivi
        </Link>
        <Link
          href="/team?showArchived=1"
          className={`rounded-md px-2.5 py-1 font-medium ${
            showArchived ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-muted"
          }`}
        >
          Archiviati
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="p-3">Email</th>
              <th className="p-3">Ruolo</th>
              <th className="p-3">MFA</th>
              <th className="p-3">Aggiunto</th>
              <th className="w-10 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  {showArchived ? "Nessun membro archiviato." : "Nessun membro attivo."}
                </td>
              </tr>
            ) : (
              members.map((m) => {
                const isMe = m.userId === currentUserId;
                return (
                  <tr
                    key={m.userId}
                    className={`border-b border-border/60 last:border-0 hover:bg-surface-muted ${
                      m.isArchived ? "opacity-60" : ""
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-text-muted" />
                        <span className="text-text">{m.email ?? "—"}</span>
                        {isMe && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                            tu
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={ROLE_VARIANTS[m.role] ?? "outline"}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-text-muted">
                      {m.requiresMfa ? (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> richiesta
                        </span>
                      ) : (
                        "non richiesta"
                      )}
                    </td>
                    <td className="p-3 text-xs text-text-muted">{formatDate(m.createdAt)}</td>
                    <td className="p-3 text-right">
                      {canManage && !isMe && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="rounded p-1 text-text-muted hover:bg-surface-muted"
                              aria-label={`Azioni per ${m.email}`}
                              disabled={busyId === m.userId}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => setEditing(m)}>
                              <Pencil className="mr-2 h-4 w-4" /> Cambia ruolo
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {m.isArchived ? (
                              <DropdownMenuItem onSelect={() => handleRestore(m)}>
                                <ArchiveRestore className="mr-2 h-4 w-4" /> Ripristina
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() => handleArchive(m)}
                                className="text-danger focus:text-danger"
                              >
                                <Archive className="mr-2 h-4 w-4" /> Archivia
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <RoleEditDialog
          member={editing}
          onClose={() => setEditing(null)}
          onError={setError}
          onSuccess={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function RoleEditDialog({
  member,
  onClose,
  onSuccess,
  onError,
}: {
  member: TeamMember;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (role === member.role) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await updateMemberRole(member.userId, role);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Errore aggiornamento ruolo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="mb-1 text-xl font-bold text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Cambia ruolo
        </h2>
        <p className="mb-4 text-xs text-text-muted">{member.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {(["owner", "editor"] as Role[]).map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  role === r
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface-muted"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-text">{ROLE_LABELS[r]}</div>
                  <div className="text-xs text-text-muted">
                    {r === "owner"
                      ? "Accesso completo. Approvazione contenuti, gestione team, audit. Richiede MFA (RU-3)."
                      : "Genera, programma, pubblica, edita brand kit. Non approva ne gestisce marchi/team."}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {role === "owner" && member.role !== "owner" && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Attenzione: promuovere a Owner setta requires_mfa=true (RU-3).
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-muted disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting || role === member.role}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Salvo…" : "Conferma"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
