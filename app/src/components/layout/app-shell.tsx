// Wrapper globale per pagine protette: header + sidebar + main.
// Server component: legge sessione internamente via getSessionOrRedirect (già chiamato dal layout, qui riceviamo i dati per props).

import Link from "next/link";
import { PowerOff } from "lucide-react";
import { DesktopSidebar, MobileBottomBar } from "@/components/layout/sidebar";
import { AreaTabBar } from "@/components/layout/area-tabs";
import { BrandFilterBanner } from "@/components/layout/brand-filter-banner";
import { Header } from "@/components/layout/header";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import type { Role } from "@/lib/auth/permissions";
import { getAiSafetyStatus, getPlatformBranding } from "@/modules/m11-admin/public";
import { listBrands } from "@/modules/m02-brand/public";
import { getBrandFilter } from "@/lib/ui/brand-filter";
import { RobotWidget } from "@/modules/m14-robot-assistant/server";

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
  // banner globale quando AI e sospesa (visibile a tutti gli utenti loggati)
  // branding piattaforma white label
  // + selettore marchio globale: carichiamo i brand attivi e il filtro corrente
  const [aiSafety, branding, brandRows, currentBrand] = await Promise.all([
    getAiSafetyStatus(organizationId),
    getPlatformBranding(organizationId),
    listBrands(organizationId, "active"),
    getBrandFilter(null),
  ]);
  const brands = brandRows.map((b) => ({
    slug: b.slug,
    displayName: b.displayName,
    color: b.color,
  }));

  // Applica il colore primary custom via CSS variable inline
  const rootStyle = branding.platformPrimaryColor
    ? ({ "--primary": branding.platformPrimaryColor } as React.CSSProperties)
    : undefined;

  return (
    <ConfirmProvider>
      <div className="flex min-h-screen flex-col bg-bg" style={rootStyle}>
        <Header
          email={email}
          role={role}
          organizationId={organizationId}
          platformName={branding.platformName}
          platformLogoUrl={branding.platformLogoUrl}
          brands={brands}
          currentBrand={currentBrand}
        />
        <BrandFilterBanner currentBrand={currentBrand} brands={brands} />
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
          <DesktopSidebar role={role} brands={brands} currentBrand={currentBrand} />
          <main className="flex-1 px-4 py-6 pb-20 md:px-6 md:pb-6 lg:mx-auto lg:max-w-6xl lg:px-8">
            <AreaTabBar />
            {children}
          </main>
        </div>
        <MobileBottomBar role={role} />
        {/* Assistente AI fluttuante (gated per ruolo). */}
        <RobotWidget />
      </div>
    </ConfirmProvider>
  );
}
