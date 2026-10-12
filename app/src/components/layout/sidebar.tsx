"use client";

// Sidebar navigation con drawer mobile.
// Organizzazione in 6 gruppi semantici (capitolato §7.2):
//   1. Operativo quotidiano  — cosa si apre ogni mattina
//   2. Marketing             — produrre e distribuire messaggi
//   3. Commerciale           — motore fedelta/offerte/ordini
//   4. Clienti               — anagrafica relazione
//   5. Insight               — misurare
//   6. Configurazione        — una tantum
// Dentro "Marketing" il gruppo "Contenuti" resta collassabile (default aperto
// quando sei dentro /contenuti). Gli altri gruppi hanno solo heading, sempre
// visibili. Le voci sono filtrate per capability dell'utente corrente.

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

type NavGroup = {
  key: string;
  heading: string;
  items: LeafItem[];
};

// 6 gruppi semantici. Le sotto-voci di "Contenuti" sono gestite a parte
// (collassabile), quindi non figurano qui dentro Marketing.
const NAV_GROUPS: NavGroup[] = [
  {
    key: "operativo",
    heading: "Operativo quotidiano",
    items: [
      { href: "/dashboard", label: "Home", icon: Home },
      { href: "/contenuti/calendario", label: "Calendario", icon: CalendarCheck2 },
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
    ],
  },
  {
    key: "marketing",
    heading: "Marketing",
    // "Contenuti" renderizzato a parte (gruppo collassabile)
    items: [
      {
        href: "/iscrizioni",
        label: "Iscrizioni",
        icon: QrCode,
        requiresCapability: "signup.events.read",
      },
      {
        href: "/segmenti",
        label: "Segmenti",
        icon: Filter,
        requiresCapability: "segment.read",
      },
      {
        href: "/campagne",
        label: "Campagne",
        icon: Megaphone,
        requiresCapability: "campaign.read",
      },
    ],
  },
  {
    key: "commerciale",
    heading: "Commerciale",
    items: [
      { href: "/fedelta", label: "Fedeltà", icon: Gift, requiresCapability: "loyalty.read" },
      {
        href: "/catalogo",
        label: "Catalogo",
        icon: Package,
        requiresCapability: "catalog.read",
      },
      { href: "/ordini", label: "Ordini", icon: ShoppingBag, requiresCapability: "orders.read" },
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
    ],
  },
  {
    key: "clienti",
    heading: "Clienti",
    items: [
      { href: "/contatti", label: "Contatti", icon: Contact, requiresCapability: "contacts.read" },
    ],
  },
  {
    key: "insight",
    heading: "Insight",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        requiresCapability: "analytics.read",
      },
    ],
  },
  {
    key: "config",
    heading: "Configurazione",
    items: [
      { href: "/marchi", label: "Marchi", icon: Tag, requiresCapability: "brand.kit.edit" },
      {
        href: "/governance",
        label: "Governance",
        icon: ShieldCheck,
        requiresCapability: "governance.read",
      },
      { href: "/team", label: "Team", icon: Users, requiresCapability: "team.read" },
      { href: "/audit", label: "Audit log", icon: ScrollText, requiresCapability: "audit.read" },
      { href: "/impostazioni", label: "Impostazioni", icon: Settings },
    ],
  },
];

// Sotto-voci del gruppo "Contenuti" (dentro Marketing)
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

// Tutti gli href registrati (per il calcolo di isActive con precedenza).
const ALL_HREFS: string[] = [
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
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

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted first:mt-0"
      style={{ fontFamily: "var(--font-bricolage)" }}
    >
      {children}
    </div>
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

  // Filtra i gruppi: nasconde quelli senza voci visibili per il ruolo corrente.
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => itemVisible(i, role)),
  })).filter((g) => g.items.length > 0 || g.key === "marketing");
  // Marketing resta visibile anche se vuoto: contiene sempre il gruppo "Contenuti".

  return (
    <nav className="flex min-h-full flex-col gap-0.5 px-3 py-4">
      {visibleGroups.map((group) => (
        <div key={group.key}>
          <GroupHeading>{group.heading}</GroupHeading>

          {/* Dentro Marketing, inseriamo per primo il gruppo "Contenuti" collassabile */}
          {group.key === "marketing" && (
            <>
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
                  {open ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
              {open &&
                CONTENT_CHILDREN.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, currentStatus, parseHref(item.href))}
                    {...(onNavigate !== undefined ? { onNavigate } : {})}
                  />
                ))}
            </>
          )}

          {/* Voci del gruppo */}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, currentStatus, parseHref(item.href))}
              {...(onNavigate !== undefined ? { onNavigate } : {})}
            />
          ))}
        </div>
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
