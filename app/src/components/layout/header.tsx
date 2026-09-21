// Header globale. Server component minimale: logo + user menu.
// BrandSwitcher rimosso in design-refresh: era funzionalmente inerte (nessuna
// vista consumava lo scope). Navigazione per marchio avviene per URL/click
// (/contenuti/[slug], /marchi/[slug]).

import Link from "next/link";
import { MobileSidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export async function Header({
  email,
  role,
}: {
  email: string;
  role: string;
  organizationId: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <Link
          href="/dashboard"
          className="text-lg font-extrabold uppercase tracking-[0.1em] text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Regìa
        </Link>
      </div>

      <UserMenu email={email} role={role} />
    </header>
  );
}
