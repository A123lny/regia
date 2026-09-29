"use client";

// Sidebar navigation con drawer mobile.
// "Contenuti" e un gruppo espandibile con 4 sotto-voci filtrate per stato pipeline.
// Il gruppo e auto-espanso se sei dentro /contenuti (esclusi calendari); l'utente
// puo forzare aperto/chiuso col chevron.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Tag,
  Sparkles,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  FileEdit,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  Users,
  Archive,
  Contact,
  Package,
  ShoppingBag,
  Gift,
  Filter,
  Megaphone,
  UtensilsCrossed,
  QrCode,
  BarChart3,
  ShieldCheck,
  BellRing,
  Truck,
  UserX,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(protected)/logout-action";
import { hasCapability, type Role, type Capability } from "@/lib/auth/permissions";

type LeafItem = {
  href: string;
  label: string;
  icon: typeof Home;
  indent?: boolean;
  requiresCapability?: Capability;
};

// NAV top-level. Le sotto-voci di "Contenuti" sono renderizzate a parte se il gruppo e aperto.
const TOP_NAV: LeafItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/marchi", label: "Marchi", icon: Tag, requiresCapability: "brand.kit.edit" },
  // "Contenuti" gestito separatamente come gruppo
  { href: "/contenuti/calendario", label: "Calendario", icon: CalendarCheck2 },
  { href: "/contatti", label: "Contatti", icon: Contact, requiresCapability: "contacts.read" },
  { href: "/catalogo", label: "Catalogo", icon: Package, requiresCapability: "catalog.read" },
  { href: "/ordini", label: "Ordini", icon: ShoppingBag, requiresCapability: "orders.read" },
  { href: "/fedelta", label: "Fedeltà", icon: Gift, requiresCapability: "loyalty.read" },
  { href: "/segmenti", label: "Segmenti", icon: Filter, requiresCapability: "segment.read" },
  { href: "/campagne", label: "Campagne", icon: Megaphone, requiresCapability: "campaign.read" },
  {
    href: "/ristoranti",
    label: "Ristoranti",
    icon: UtensilsCrossed,
    requiresCapability: "partner.read",
  },
  {
    href: "/fornitori",
    label: "Fornitori",
    icon: Truck,
    requiresCapability: "supply.read",
  },
  {
    href: "/iscrizioni",
    label: "Iscrizioni",
    icon: QrCode,
    requiresCapability: "signup.events.read",
  },
  {
    href: "/promemoria",
    label: "Promemoria",
    icon: BellRing,
    requiresCapability: "reminders.read",
  },
  {
    href: "/anti-abbandono",
    label: "Anti-abbandono",
    icon: UserX,
    requiresCapability: "abandonment.read",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    requiresCapability: "analytics.read",
  },
  {
    href: "/governance",
    label: "Governance",
    icon: ShieldCheck,
    requiresCapability: "governance.read",
  },
  { href: "/team", label: "Team", icon: Users, requiresCapability: "team.read" },
  { href: "/audit", label: "Audit log", icon: ScrollText, requiresCapability: "audit.read" },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

const CONTENT_CHILDREN: LeafItem[] = [
  { href: "/contenuti?status=draft", label: "Bozze", icon: FileEdit, indent: true },
  { href: "/contenuti?status=approved", label: "Approvate", icon: CalendarClock, indent: true },
  { href: "/contenuti?status=scheduled", label: "Programmate", icon: CalendarCheck2, indent: true },
  { href: "/contenuti?status=published", label: "Pubblicate", icon: CheckCircle2, indent: true },
  { href: "/contenuti/archivio", label: "Archivio", icon: Archive, indent: true },
];

function itemVisible(item: LeafItem, role: Role): boolean {
  return item.requiresCapability === undefined || hasCapability(role, item.requiresCapability);
}

// Tutti gli href della sidebar (per il calcolo di isActive con precedenza)
const ALL_HREFS: string[] = [
  ...TOP_NAV.map((i) => i.href),
  "/contenuti",
  ...CONTENT_CHILDREN.map((i) => i.href),
];

type ParsedHref = { path: string; status: string | null };

function parseHref(href: string): ParsedHref {
  const [pathPart, queryPart = ""] = href.split("?");
  return {
    path: pathPart ?? href,
    status: new URLSearchParams(queryPart).get("status"),
  };
}

const ALL_PARSED: ParsedHref[] = ALL_HREFS.map(parseHref);

function isActive(currentPath: string, currentStatus: string | null, item: ParsedHref): boolean {
  if (item.status !== null) {
    return currentPath === item.path && currentStatus === item.status;
  }
  const pathMatches = currentPath === item.path || currentPath.startsWith(item.path + "/");
  if (!pathMatches) return false;
  if (currentStatus !== null) {
    const filterMatches = ALL_PARSED.some(
      (o) => o.path === currentPath && o.status === currentStatus,
    );
    if (filterMatches) return false;
  }
  return !ALL_PARSED.some(
    (o) =>
      o.status === null &&
      o.path !== item.path &&
      o.path.startsWith(item.path + "/") &&
      (currentPath === o.path || currentPath.startsWith(o.path + "/")),
  );
}

function itemClasses(active: boolean, indent: boolean): string {
  const base = `flex items-center gap-3 rounded-md py-2 text-sm font-bold transition-colors ${
    indent ? "ml-4 pl-3 pr-3 text-[13px]" : "px-3"
  }`;
  const state = active
    ? "border-l-[3px] border-primary bg-surface-muted text-primary"
    : "text-text hover:bg-surface-muted";
  return `${base} ${state}`;
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: LeafItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
      style={{ fontFamily: "var(--font-bricolage)" }}
      className={itemClasses(active, item.indent ?? false)}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status");

  const isInContentSection =
    pathname === "/contenuti" ||
    (pathname.startsWith("/contenuti/") && !pathname.startsWith("/contenuti/calendario"));

  // Se null: usa il default derivato dal path. Se boolean: rispetta la scelta manuale.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? isInContentSection;

  const contentParsed = parseHref("/contenuti");
  const contentActive = isActive(pathname, currentStatus, contentParsed);
  const visibleTop = TOP_NAV.filter((i) => itemVisible(i, role));
  // Home + Marchi = prime due voci originali; se una non e visibile, si adegua
  const beforeContenuti = visibleTop.filter((i) => i.href === "/dashboard" || i.href === "/marchi");
  const afterContenuti = visibleTop.filter((i) => i.href !== "/dashboard" && i.href !== "/marchi");

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {/* Home + Marchi (top-level prima del gruppo Contenuti) */}
      {beforeContenuti.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(pathname, currentStatus, parseHref(item.href))}
          {...(onNavigate !== undefined ? { onNavigate } : {})}
        />
      ))}

      {/* Gruppo Contenuti collassabile — l'intera riga (link + chevron) riceve lo stile active */}
      <div
        className={`flex items-center rounded-md transition-colors ${
          contentActive
            ? "border-l-[3px] border-primary bg-surface-muted text-primary"
            : "text-text hover:bg-surface-muted"
        }`}
      >
        <Link
          href="/contenuti"
          {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
          style={{ fontFamily: "var(--font-bricolage)" }}
          className="flex flex-1 items-center gap-3 px-3 py-2 text-sm font-bold"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Contenuti
        </Link>
        <button
          type="button"
          onClick={() => setManual(!open)}
          aria-label={open ? "Chiudi sotto-voci Contenuti" : "Apri sotto-voci Contenuti"}
          aria-expanded={open}
          className="mr-1 rounded-md p-1.5 hover:bg-black/5"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Sotto-voci (a scomparsa) */}
      {open &&
        CONTENT_CHILDREN.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, currentStatus, parseHref(item.href))}
            {...(onNavigate !== undefined ? { onNavigate } : {})}
          />
        ))}

      {/* Restanti voci top-level (Calendario, Team, Audit, Impostazioni) filtrate per capability */}
      {afterContenuti.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(pathname, currentStatus, parseHref(item.href))}
          {...(onNavigate !== undefined ? { onNavigate } : {})}
        />
      ))}

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
    </nav>
  );
}

export function DesktopSidebar({ role }: { role: Role }) {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-surface md:flex md:flex-col">
      <NavList role={role} />
    </aside>
  );
}

export function MobileSidebar({ role }: { role: Role }) {
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
        <NavList role={role} />
      </SheetContent>
    </Sheet>
  );
}
