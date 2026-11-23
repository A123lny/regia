// Pagina 404 personalizzata (sovrascrive la default inglese di Next.js).

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pagina non trovata — Regìa",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center">
      <h1 className="text-5xl font-bold text-text">404</h1>
      <h2 className="text-xl font-semibold text-text">Pagina non trovata</h2>
      <p className="text-sm text-text-muted">
        L&apos;indirizzo che hai aperto non esiste o &egrave; stato spostato. Torna alla dashboard
        per continuare.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Torna alla dashboard
      </Link>
    </main>
  );
}
