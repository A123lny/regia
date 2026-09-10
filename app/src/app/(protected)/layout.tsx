import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrRedirect();

  // F0: no RLS select policy yet — bypass via service_role.
  const admin = getAdminClient();
  const { data: userRow } = await admin.auth.admin.getUserById(session.userId);
  const email = userRow.user?.email ?? "utente@regia.local";

  return (
    <AppShell email={email} role={session.role}>
      {children}
    </AppShell>
  );
}
