"use client";

// RN-robot T4: pallina fluttuante 🤖 bottom-right + Sheet con chat-panel.
// Statico in T4: nessuna chiamata backend ancora. T5 connette alla rotta SSE.

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/auth/permissions";
import { RobotChatPanel } from "./chat-panel";

const PAGE_TITLES: Record<string, string> = {
  "/": "Cruscotto",
  "/contatti": "Contatti",
  "/calendario": "Calendario editoriale",
  "/marchi": "Marchi",
  "/governance": "Governance",
  "/impostazioni": "Impostazioni",
  "/fornitori": "Fornitori",
};

function pathToTitle(pathname: string): string {
  const base = "/" + (pathname.split("/").filter(Boolean)[0] ?? "");
  return PAGE_TITLES[base] ?? "Regìa";
}

export function RobotWidgetClient({ userId, role }: { userId: string; role: Role }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname() ?? "/";
  const pageTitle = pathToTitle(pathname);

  return (
    <>
      <button
        type="button"
        data-testid="robot-bubble"
        aria-label="Apri assistente Regia"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary animate-pulse"
        style={{
          background: "linear-gradient(135deg, #7c3aed, #ec4899)",
        }}
      >
        <span aria-hidden="true">🤖</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col p-0" data-testid="robot-panel">
          <SheetHeader className="border-b">
            <SheetTitle>Regia · Assistente</SheetTitle>
            <SheetDescription>
              Chiedimi cosa puoi fare in questa pagina ({pageTitle}) o come si fa qualcosa.
            </SheetDescription>
          </SheetHeader>
          <RobotChatPanel userId={userId} role={role} pageTitle={pageTitle} pagePath={pathname} />
        </SheetContent>
      </Sheet>
    </>
  );
}
