// Wrapper globale per pagine protette: header + sidebar + main.
// Server component: legge sessione internamente via getSessionOrRedirect (già chiamato dal layout, qui riceviamo i dati per props).

import Link from "next/link";
import { PowerOff } from "lucide-react";
import { DesktopSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { Role } from "@/lib/auth/permissions";
import { getAiSafetyStatus, getPlatformBranding } from "@/modules/m11-admin/public";

export async function AppShell({
  children,
  email,
  role,
  organizationId,
}: {
  children: React.ReactNode;
  email: string;
  role: Role;
  organizationId: string;
}) {
  // RF-11.4: banner globale quando AI e sospesa (visibile a tutti gli utenti loggati)
  // RF-2.7: branding piattaforma white label
  const [aiSafety, branding] = await Promise.all([
    getAiSafetyStatus(organizationId),
    getPlatformBranding(organizationId),
  ]);

  // Applica il colore primary custom via CSS variable inline
  const rootStyle = branding.platformPrimaryColor
    ? ({ "--primary": branding.platformPrimaryColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-bg" style={rootStyle}>
      <Header
        email={email}
        role={role}
        organizationId={organizationId}
        platformName={branding.platformName}
        platformLogoUrl={branding.platformLogoUrl}
      />
      {aiSafety.killSwitchOn && (
        <div className="border-b border-danger bg-danger/10 px-4 py-2 text-center text-sm text-danger">
          <PowerOff className="mr-1 inline-block h-4 w-4" />
          <strong>Generazioni AI sospese</strong>
          {aiSafety.killSwitchReason && <> — {aiSafety.killSwitchReason}</>}
          {role === "owner" && (
            <>
              {" — "}
              <Link href="/impostazioni" className="underline hover:no-underline">
                Riattiva
              </Link>
            </>
          )}
        </div>
      )}
      <div className="flex flex-1">
        <DesktopSidebar role={role} />
        <main className="flex-1 px-4 py-6 md:px-6 lg:mx-auto lg:max-w-6xl lg:px-8">{children}</main>
      </div>
    </div>
  );
}
