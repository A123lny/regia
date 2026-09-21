// Header globale. Server component: legge scope e marchi lato server.

import Link from "next/link";
import { MobileSidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { BrandSwitcher } from "@/components/brand/brand-switcher";
import { type BrandSlug } from "@/components/brand/brand-chip";
import { getBrandScope } from "@/lib/brand/scope";
import { getAdminClient } from "@/lib/db/admin";

export async function Header({
  email,
  role,
  organizationId,
}: {
  email: string;
  role: string;
  organizationId: string;
}) {
  const scope = await getBrandScope();
  const admin = getAdminClient();
  // F0: no RLS select policy yet — bypass via service_role. Rimosso in F1.2 quando arrivano policy select.
  const { data: brandRows } = await admin
    .from("brands")
    .select("slug, display_name")
    .eq("organization_id", organizationId)
    .order("display_name");

  const brands = (brandRows ?? []).map((b: { slug: string; display_name: string }) => ({
    slug: b.slug as BrandSlug,
    displayName: b.display_name,
  }));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <Link href="/dashboard" className="font-serif text-xl font-semibold text-text">
          Regìa
        </Link>
      </div>

      <BrandSwitcher currentScope={scope} brands={brands} />

      <UserMenu email={email} role={role} />
    </header>
  );
}
