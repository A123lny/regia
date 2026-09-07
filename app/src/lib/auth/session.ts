import { redirect } from "next/navigation";
import { getServerClient } from "../db/server";
import { getAdminClient } from "../db/admin";

export type Session = {
  userId: string;
  role: "owner" | "editor" | "delegate" | "agent";
  organizationId: string;
};

export async function getSessionOrRedirect(loginPath = "/login"): Promise<Session> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginPath);

  // Uso admin (service_role) per leggere users_profile: RLS è attiva con
  // denial-by-default (migrazione _000007_) e nessuna policy select per ora.
  // In F1 le policy select scoped-per-organization arriveranno insieme ai
  // moduli funzionali; il bypass via service_role qui è intenzionale (RS-2).
  const admin = getAdminClient();
  type ProfileRow = { organization_id: string; role: string };
  const { data: profile, error } = await admin
    .from("users_profile")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single<ProfileRow>();

  if (error || !profile) {
    // L'utente esiste in auth.users ma non ha profile: caso da fixare a mano.
    redirect(loginPath);
  }

  return {
    userId: user.id,
    role: profile.role as Session["role"],
    organizationId: profile.organization_id,
  };
}
