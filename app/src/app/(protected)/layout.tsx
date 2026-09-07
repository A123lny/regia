import { getSessionOrRedirect } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await getSessionOrRedirect();
  return <>{children}</>;
}
