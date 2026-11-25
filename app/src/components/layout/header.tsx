// Header globale. Server component minimale: logo + user menu.
// nome + logo piattaforma dinamici (white label).

import Link from "next/link";
import { MobileSidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import type { Role } from "@/lib/auth/permissions";

type BrandOption = { slug: string; displayName: string; color: string };

export async function Header({
  email,
  role,
  platformName = "Regìa",
  platformLogoUrl = null,
  brands = [],
  currentBrand = null,
}: {
  email: string;
  role: Role;
  organizationId: string;
  platformName?: string;
  platformLogoUrl?: string | null;
  brands?: BrandOption[];
  currentBrand?: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <MobileSidebar role={role} brands={brands} currentBrand={currentBrand} />
        <Link
          href="/oggi"
          className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-[0.1em] text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {platformLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={platformLogoUrl}
              alt={`Logo ${platformName}`}
              className="h-7 w-auto object-contain"
            />
          )}
          {platformName}
        </Link>
      </div>

      <UserMenu email={email} role={role} />
    </header>
  );
}
