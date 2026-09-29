"use server";

// M11 — Server actions per la gestione del team.
// Owner-only (team.manage). Guardie critiche:
//   - Nessuno puo modificare/archiviare se stesso (protezione lockout).
//   - Nessuno puo degradare o archiviare l'ULTIMO owner attivo (protezione lockout org).
//   - Promuovere a owner setta requires_mfa=true (RU-3).
//   - Solo ruoli 'owner' e 'editor' sono assegnabili via UI ('delegate'/'agent' dormienti).

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Role } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { countActiveOwners, getMemberProfile, type TeamMember } from "./team-query";

const ASSIGNABLE_ROLES: Role[] = ["owner", "editor"];

async function requireTeamManage() {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");
  return session;
}

function revalidateTeam() {
  revalidatePath("/team");
  revalidatePath("/impostazioni");
}

export async function updateMemberRole(userId: string, newRole: Role): Promise<TeamMember> {
  const session = await requireTeamManage();

  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    throw new Error(`Ruolo "${newRole}" non assegnabile via UI (solo owner o editor)`);
  }

  if (userId === session.userId) {
    throw new Error("Non puoi modificare il tuo stesso ruolo (protezione lockout)");
  }

  const current = await getMemberProfile(session.organizationId, userId);
  if (!current) throw new Error("Membro non trovato");
  if (current.isArchived)
    throw new Error("Il membro e archiviato: ripristinalo prima di modificarlo");
  if (current.role === newRole) return current;

  // Guardia lockout: non degradare l'ultimo owner attivo
  if (current.role === "owner" && newRole !== "owner") {
    const owners = await countActiveOwners(session.organizationId);
    if (owners <= 1) {
      throw new Error("Non puoi degradare l'ultimo Owner attivo dell'organizzazione");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: { role: Role; requires_mfa?: boolean } = { role: newRole };
  // Promozione a owner: RU-3 richiede MFA (predisposizione F0, enforcement reale F0-b)
  if (newRole === "owner") patch.requires_mfa = true;
  // Degradazione da owner: rimuovo requires_mfa (torna default)
  if (current.role === "owner" && newRole !== "owner") patch.requires_mfa = false;

  const { error } = await admin
    .from("users_profile")
    .update(patch)
    .eq("user_id", userId)
    .eq("organization_id", session.organizationId);
  if (error) throw new Error(`Errore aggiornamento ruolo: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "team.role_updated",
    target: `user:${userId}`,
    details: { from: current.role, to: newRole },
  });

  revalidateTeam();
  const updated = await getMemberProfile(session.organizationId, userId);
  if (!updated) throw new Error("Membro sparito dopo update (race?)");
  return updated;
}

export async function archiveMember(userId: string): Promise<TeamMember> {
  const session = await requireTeamManage();

  if (userId === session.userId) {
    throw new Error("Non puoi archiviare te stesso (protezione lockout)");
  }

  const current = await getMemberProfile(session.organizationId, userId);
  if (!current) throw new Error("Membro non trovato");
  if (current.isArchived) return current;

  // Guardia lockout: non archiviare l'ultimo owner attivo
  if (current.role === "owner") {
    const owners = await countActiveOwners(session.organizationId);
    if (owners <= 1) {
      throw new Error("Non puoi archiviare l'ultimo Owner attivo dell'organizzazione");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("users_profile")
    .update({ is_archived: true })
    .eq("user_id", userId)
    .eq("organization_id", session.organizationId);
  if (error) throw new Error(`Errore archiviazione membro: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "team.member_archived",
    target: `user:${userId}`,
    details: { role: current.role },
  });

  revalidateTeam();
  const updated = await getMemberProfile(session.organizationId, userId);
  if (!updated) throw new Error("Membro sparito dopo archive (race?)");
  return updated;
}

export async function restoreMember(userId: string): Promise<TeamMember> {
  const session = await requireTeamManage();

  const current = await getMemberProfile(session.organizationId, userId);
  if (!current) throw new Error("Membro non trovato");
  if (!current.isArchived) return current;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("users_profile")
    .update({ is_archived: false })
    .eq("user_id", userId)
    .eq("organization_id", session.organizationId);
  if (error) throw new Error(`Errore ripristino membro: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "team.member_restored",
    target: `user:${userId}`,
    details: { role: current.role },
  });

  revalidateTeam();
  const updated = await getMemberProfile(session.organizationId, userId);
  if (!updated) throw new Error("Membro sparito dopo restore (race?)");
  return updated;
}
