// Wrapper globale per pagine protette: header + sidebar + main.
// Server component: legge sessione internamente via getSessionOrRedirect (già chiamato dal layout, qui riceviamo i dati per props).

import { DesktopSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export async function AppShell({
  children,
  email,
  role,
}: {
  children: React.ReactNode;
  email: string;
  role: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Header email={email} role={role} />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="flex-1 px-4 py-6 md:px-6 lg:mx-auto lg:max-w-6xl lg:px-8">{children}</main>
      </div>
    </div>
  );
}
