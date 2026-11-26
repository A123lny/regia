// Diagnostica integrazioni: test di connessione reali per ciascun servizio.
// Owner-only. Utile quando qualcosa non funziona ma non è chiaro perché.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { DiagnosticaClient } from "./diagnostica-client";
import { OrphansPanel } from "./orphans-panel";

export const metadata: Metadata = { title: "Diagnostica" };

export default async function DiagnosticaPage() {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") notFound();

  return (
    <div className="space-y-6 overflow-x-hidden">
      <header className="space-y-1">
        <h1
          className="text-3xl font-extrabold uppercase tracking-tight text-text"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Diagnostica integrazioni
        </h1>
        <p className="text-sm text-text-muted">
          Chiama ciascun servizio esterno con una richiesta minima reale. Usa questa pagina quando
          qualcosa non funziona ma non è chiaro perché.
        </p>
      </header>
      <DiagnosticaClient />
      <OrphansPanel />
    </div>
  );
}
