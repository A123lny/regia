"use client";

// Sidebar: 5 aree (Oggi · Contenuti · Clienti · Rete · Impostazioni).
// Ogni vecchia voce e' raggiungibile come scheda dentro l'area, con la stessa
// URL + ?scheda=... (vedi docs/inventario-funzioni.md per la mappa completa).
// In cima: selettore marchio globale.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Users as UsersIcon,
  Network,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(protected)/logout-action";
import { hasCapability, type Role, type Capability } from "@/lib/auth/permissions";
import { BrandPicker } from "./brand-picker";

type Area = {
  key: "oggi" | "contenuti" | "clienti" | "rete" | "impostazioni";
  href: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  // Visibile se l'utente ha almeno una delle capability. undefined = sempre visibile.
  requiresAnyOf?: Capability[];
};

const AREAS: Area[] = [
  {
    key: "oggi",
    href: "/oggi",
    label: "Oggi",
    icon: Home,
  },
  {
    key: "contenuti",
    href: "/contenuti",
    label: "Contenuti",
    icon: FileText,
    requiresAnyOf: ["content.generate", "content.approve", "content.schedule"],
  },
  {
    key: "clienti",
    href: "/clienti",
    label: "Clienti",
    icon: UsersIcon,
    requiresAnyOf: [
      "contacts.read",
      "reminders.read",
      "loyalty.read",
      "segment.read",
      "signup.events.read",
      "abandonment.read",
      "reviews.read",
    ],
  },
  {
    key: "rete",
    href: "/rete",
    label: "Rete",
    icon: Network,
    requiresAnyOf: ["partner.read", "supply.read", "catalog.read", "orders.read"],
  },
  {
    key: "impostazioni",
    href: "/impostazioni",
    label: "Impostazioni",
    icon: Settings,
  },
];

function areaVisible(area: Area, role: Role): boolean {
  if (!area.requiresAnyOf || area.requiresAnyOf.length === 0) return true;
  return area.requiresAnyOf.some((c) => hasCapability(role, c));
}

function isAreaActive(pathname: string, areaHref: string): boolean {
  // "/oggi" → match anche per path dentro Oggi come /oggi/giorno/...
  return pathname === areaHref || pathname.startsWith(areaHref + "/");
}

function areaClasses(active: boolean): string {
  const base = "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition-colors";
  return active
    ? `${base} border-l-[3px] border-primary bg-surface-muted text-primary`
    : `${base} text-text hover:bg-surface-muted`;
}

type BrandOption = { slug: string; displayName: string; color: string };

function NavList({
  role,
  brands,
  currentBrand,
  onNavigate,
}: {
  role: Role;
  brands: BrandOption[];
  currentBrand: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleAreas = AREAS.filter((a) => areaVisible(a, role));

  return (
    <nav className="flex min-h-full flex-col">
      <BrandPicker brands={brands} current={currentBrand} />

      <div className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {visibleAreas.map((area) => {
          const Icon = area.icon;
          const active = isAreaActive(pathname, area.href);
          return (
            <Link
              key={area.key}
              href={area.href}
              {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
              style={{ fontFamily: "var(--font-bricolage)" }}
              className={areaClasses(active)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {area.label}
            </Link>
          );
        })}

        <form action={logout} className="mt-auto pt-4">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-3 text-sm font-bold"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Esci
          </Button>
        </form>
      </div>
    </nav>
  );
}

export function DesktopSidebar({
  role,
  brands,
  currentBrand,
}: {
  role: Role;
  brands: BrandOption[];
  currentBrand: string | null;
}) {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-surface md:flex md:flex-col">
      <NavList role={role} brands={brands} currentBrand={currentBrand} />
    </aside>
  );
}

export function MobileSidebar({
  role,
  brands,
  currentBrand,
}: {
  role: Role;
  brands: BrandOption[];
  currentBrand: string | null;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Apri menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle
            className="text-lg font-extrabold uppercase tracking-[0.1em]"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Regìa
          </SheetTitle>
        </SheetHeader>
        <NavList role={role} brands={brands} currentBrand={currentBrand} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Bottom bar mobile: 5 aree in orizzontale sticky in basso.
 * Nascosta su desktop. "Altro" = /impostazioni.
 */
export function MobileBottomBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleAreas = AREAS.filter((a) => areaVisible(a, role));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
      <div className="flex items-stretch">
        {visibleAreas.map((area) => {
          const Icon = area.icon;
          const active = isAreaActive(pathname, area.href);
          return (
            <Link
              key={area.key}
              href={area.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold uppercase ${
                active ? "text-primary" : "text-text-muted"
              }`}
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {area.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
