"use client";

// Sidebar navigation con drawer mobile.
// Voci F1.1: Home, Marchi, Audit log, Impostazioni.
// F1.2+ aggiungeranno voci qui.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tag, Sparkles, ScrollText, Settings, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(protected)/logout-action";

type NavItem = { href: string; label: string; icon: typeof Home };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/marchi", label: "Marchi", icon: Tag },
  { href: "/contenuti", label: "Contenuti", icon: Sparkles },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-l-[3px] border-primary bg-surface-muted text-primary"
                : "text-text hover:bg-surface-muted"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <form action={logout} className="mt-auto pt-4">
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start gap-3 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Esci
        </Button>
      </form>
    </nav>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <NavList />
    </aside>
  );
}

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Apri menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="font-serif text-lg">Regìa</SheetTitle>
        </SheetHeader>
        <NavList />
      </SheetContent>
    </Sheet>
  );
}
