// Barra di schede dell'area corrente. Client component che deduce quali
// tabs mostrare dalla pathname. Le tabs sono <Link> alle route esistenti
// (nessuna duplicazione del contenuto).
//
// Incluso nel layout (protected) PRIMA del children, cosi' appare su tutte
// le pagine delle aree. Se l'URL non e' sotto nessuna area con tabs
// (es. /impostazioni/marchi/[slug]/media), il componente non renderizza nulla.

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Tab = {
  /** Etichetta visibile della scheda. */
  label: string;
  /** URL della scheda. Puo' avere query string (es. /contenuti?status=draft). */
  href: string;
  /** Capability eventuale (stringa libera, filtrata dal server component che
   *  passa le tabs). Il componente stesso e' client-side e non ha access a Role,
   *  quindi la filtraggio sulle capability va fatto a monte. */
};

type AreaDef = {
  key: string;
  /** Un prefisso path (o uguale) significa che siamo in questa area. */
  matches: (path: string) => boolean;
  /** Titolo breve dell'area, mostrato sopra la tab bar. */
  title: string;
  /** Una riga di spiegazione. */
  subtitle: string;
  tabs: Tab[];
  /** Determina quale tab e' attiva data la pathname + status query. */
  activeTab: (path: string, status: string | null) => string;
};

// --- Definizioni area --------------------------------------------------------

const CONTENUTI: AreaDef = {
  key: "contenuti",
  matches: (p) => p === "/contenuti" || p.startsWith("/contenuti/") || p.startsWith("/campagne"),
  title: "Contenuti",
  subtitle: "Bozze da revisionare, calendario editoriale, archivio, campagne.",
  tabs: [
    { label: "Da approvare", href: "/contenuti?status=draft" },
    { label: "Approvate", href: "/contenuti?status=approved" },
    { label: "In calendario", href: "/contenuti/calendario" },
    { label: "Pubblicate", href: "/contenuti?status=published" },
    { label: "Rifiutate", href: "/contenuti?status=rejected" },
    { label: "Archivio", href: "/contenuti/archivio" },
    { label: "Campagne", href: "/campagne" },
    { label: "Per marchio", href: "/contenuti" },
  ],
  activeTab: (path, status) => {
    if (path.startsWith("/campagne")) return "/campagne";
    if (path.startsWith("/contenuti/archivio")) return "/contenuti/archivio";
    if (path.startsWith("/contenuti/calendario")) return "/contenuti/calendario";
    if (path === "/contenuti") {
      if (status === "draft") return "/contenuti?status=draft";
      if (status === "approved") return "/contenuti?status=approved";
      if (status === "published") return "/contenuti?status=published";
      if (status === "rejected") return "/contenuti?status=rejected";
      return "/contenuti";
    }
    // pagine marchio-specifiche /contenuti/[slug]/...
    return "/contenuti";
  },
};

const CLIENTI: AreaDef = {
  key: "clienti",
  matches: (p) =>
    p === "/clienti" ||
    p.startsWith("/clienti/") ||
    p.startsWith("/contatti") ||
    p.startsWith("/promemoria") ||
    p.startsWith("/anti-abbandono") ||
    p.startsWith("/fedelta") ||
    p.startsWith("/iscrizioni") ||
    p.startsWith("/segmenti") ||
    p.startsWith("/recensioni") ||
    p.startsWith("/analytics"),
  title: "Clienti",
  subtitle: "Anagrafica, consensi, promemoria, voucher, segnali di abbandono e campagne.",
  tabs: [
    { label: "Contatti", href: "/contatti" },
    { label: "Promemoria", href: "/promemoria" },
    { label: "Da recuperare", href: "/anti-abbandono" },
    { label: "Fedeltà e voucher", href: "/fedelta" },
    { label: "Iscrizioni", href: "/iscrizioni" },
    { label: "Gruppi", href: "/segmenti" },
    { label: "Recensioni", href: "/recensioni" },
    { label: "Andamento", href: "/analytics" },
  ],
  activeTab: (path) => {
    if (path.startsWith("/contatti")) return "/contatti";
    if (path.startsWith("/promemoria")) return "/promemoria";
    if (path.startsWith("/anti-abbandono")) return "/anti-abbandono";
    if (path.startsWith("/fedelta")) return "/fedelta";
    if (path.startsWith("/iscrizioni")) return "/iscrizioni";
    if (path.startsWith("/segmenti")) return "/segmenti";
    if (path.startsWith("/recensioni")) return "/recensioni";
    if (path.startsWith("/analytics")) return "/analytics";
    return "/contatti";
  },
};

const RETE: AreaDef = {
  key: "rete",
  matches: (p) =>
    p === "/rete" ||
    p.startsWith("/rete/") ||
    p.startsWith("/ristoranti") ||
    p.startsWith("/fornitori") ||
    p.startsWith("/catalogo") ||
    p.startsWith("/ordini"),
  title: "Rete",
  subtitle: "Partner, fornitori, catalogo prodotti e ordini.",
  tabs: [
    { label: "Ristoranti", href: "/ristoranti" },
    { label: "Fornitori", href: "/fornitori" },
    { label: "Catalogo", href: "/catalogo" },
    { label: "Ordini", href: "/ordini" },
  ],
  activeTab: (path) => {
    if (path.startsWith("/fornitori")) return "/fornitori";
    if (path.startsWith("/catalogo")) return "/catalogo";
    if (path.startsWith("/ordini")) return "/ordini";
    return "/ristoranti";
  },
};

const IMPOSTAZIONI: AreaDef = {
  key: "impostazioni",
  matches: (p) =>
    p === "/impostazioni" ||
    p.startsWith("/impostazioni/") ||
    p.startsWith("/marchi") ||
    p.startsWith("/governance") ||
    p.startsWith("/team") ||
    p.startsWith("/audit"),
  title: "Impostazioni",
  subtitle: "Marchi, team, regole, registro attività, account e chiavi.",
  tabs: [
    { label: "Marchi", href: "/marchi" },
    { label: "Team", href: "/team" },
    { label: "Regole", href: "/governance" },
    { label: "Registro attività", href: "/audit" },
    { label: "Account e chiavi", href: "/impostazioni" },
  ],
  activeTab: (path) => {
    if (path.startsWith("/marchi")) return "/marchi";
    if (path.startsWith("/team")) return "/team";
    if (path.startsWith("/governance")) return "/governance";
    if (path.startsWith("/audit")) return "/audit";
    return "/impostazioni";
  },
};

const AREAS: AreaDef[] = [CONTENUTI, CLIENTI, RETE, IMPOSTAZIONI];

// --- Component ---------------------------------------------------------------

export function AreaTabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  // Non mostrare la tab bar su /oggi (pagina senza tabs), /login e pagine pubbliche
  if (pathname.startsWith("/oggi") || pathname === "/login" || pathname === "/") return null;

  const area = AREAS.find((a) => a.matches(pathname));
  if (!area) return null;

  const active = area.activeTab(pathname, status);

  return (
    <div className="mb-6 border-b border-border">
      <div className="mb-3">
        <h1
          className="text-2xl font-extrabold uppercase tracking-tight text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {area.title}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{area.subtitle}</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-px">
        {area.tabs.map((tab) => {
          const isActive = tab.href === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:border-border hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
