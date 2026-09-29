// Header globale. Server component minimale: logo + user menu.
// RF-2.7: nome + logo piattaforma dinamici (white label).

import Link from "next/link";
import { MobileSidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import type { Role } from "@/lib/auth/permissions";

export async function Header({
  email,
  role,
  platformName = "Regìa",
  platformLogoUrl = null,
}: {
  email: string;
  role: Role;
  organizationId: string;
  platformName?: string;
  platformLogoUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <MobileSidebar role={role} />
        <Link
          href="/dashboard"
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
