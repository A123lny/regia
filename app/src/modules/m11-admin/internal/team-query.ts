// M11 — Query team members per la vista Team.
// Tenant-scoped: legge users_profile filtrato per organization + join auth.users
// per l'email. Solo servizio: mai chiamato da client (usa service_role via getAdminClient).

import { getAdminClient } from "@/lib/db/admin";
import type { Role } from "@/lib/auth/permissions";

export type TeamMember = {
  userId: string;
  email: string | null;
  role: Role;
  requiresMfa: boolean;
  isArchived: boolean;
  createdAt: string;
};

export type TeamListFilter = "active" | "archived" | "all";

export async function listTeamMembers(
  organizationId: string,
  filter: TeamListFilter = "active",
): Promise<TeamMember[]> {
  const admin = getAdminClient();

  let query = admin
    .from("users_profile")
    .select("user_id, role, requires_mfa, is_archived, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (filter === "active") query = query.eq("is_archived", false);
  else if (filter === "archived") query = query.eq("is_archived", true);

  const { data: profiles, error: profilesError } = await query;
  if (profilesError) throw new Error(`Errore lettura team: ${profilesError.message}`);

  const rows =
    (profiles as Array<{
      user_id: string;
      role: string;
      requires_mfa: boolean;
      is_archived: boolean;
      created_at: string;
    }> | null) ?? [];

  // Per ogni profile, fetch email da auth.users. Al volume atteso (<10 membri)
  // il round-trip N+1 e accettabile: niente RPC dedicata.
  const members: TeamMember[] = [];
  for (const r of rows) {
    const { data: user } = await admin.auth.admin.getUserById(r.user_id);
    members.push({
      userId: r.user_id,
      email: user.user?.email ?? null,
      role: r.role as Role,
      requiresMfa: r.requires_mfa,
      isArchived: r.is_archived,
      createdAt: r.created_at,
    });
  }
  return members;
}

/**
 * Ritorna il conteggio degli owner attivi (non archiviati). Serve per la guardia
 * "non puoi degradare / archiviare l'ultimo owner rimanente".
 */
export async function countActiveOwners(organizationId: string): Promise<number> {
  const admin = getAdminClient();
  const { count, error } = await admin
    .from("users_profile")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .eq("is_archived", false);
  if (error) throw new Error(`Errore conteggio owner attivi: ${error.message}`);
  return count ?? 0;
}

/**
 * Fetch profilo di un singolo membro per verifiche (auth, ownership).
 */
export async function getMemberProfile(
  organizationId: string,
  userId: string,
): Promise<TeamMember | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("users_profile")
    .select("user_id, role, requires_mfa, is_archived, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Errore fetch profilo: ${error.message}`);
  if (!data) return null;
  const row = data as {
    user_id: string;
    role: string;
    requires_mfa: boolean;
    is_archived: boolean;
    created_at: string;
  };
  const { data: user } = await admin.auth.admin.getUserById(row.user_id);
  return {
    userId: row.user_id,
    email: user.user?.email ?? null,
    role: row.role as Role,
    requiresMfa: row.requires_mfa,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}
