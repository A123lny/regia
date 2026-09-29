import { redirect } from "next/navigation";
import { getServerClient } from "../db/server";
import { getAdminClient } from "../db/admin";

export type Session = {
  userId: string;
  role: "owner" | "editor" | "delegate" | "agent";
  organizationId: string;
  previousLoginAt: string | null; // RF-12.6: ultimo accesso PRECEDENTE (prima di aggiornare)
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
  type ProfileRow = {
    organization_id: string;
    role: string;
    is_archived: boolean;
    last_login_at: string | null;
  };
  const { data: profile, error } = await admin
    .from("users_profile")
    .select("organization_id, role, is_archived, last_login_at")
    .eq("user_id", user.id)
    .single<ProfileRow>();

  if (error || !profile) {
    // L'utente esiste in auth.users ma non ha profile: caso da fixare a mano.
    redirect(loginPath);
  }

  // Soft delete: membri archiviati non possono accedere alla piattaforma.
  if (profile.is_archived) {
    await supabase.auth.signOut();
    redirect(`${loginPath}?error=Account%20archiviato.%20Contatta%20l%27amministratore.`);
  }

  // RF-12.6: aggiorna last_login_at (throttling naturale: si scrive ad ogni request
  // ma il volume e basso — un Owner/editor non fa migliaia di navigazioni al secondo).
  // Per ridurre carico, aggiorno solo se ultimo update > 5 min fa.
  const now = new Date();
  const shouldUpdate =
    !profile.last_login_at ||
    now.getTime() - new Date(profile.last_login_at).getTime() > 5 * 60 * 1000;
  const previousLoginAt = profile.last_login_at;
  if (shouldUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = admin as any;
    await adminAny
      .from("users_profile")
      .update({ last_login_at: now.toISOString() })
      .eq("user_id", user.id);
  }

  return {
    userId: user.id,
    role: profile.role as Session["role"],
    organizationId: profile.organization_id,
    previousLoginAt,
  };
}
