// 404 "interna": appare quando una route sotto (protected) non esiste.
// A differenza della /not-found.tsx root (usata per rotte pubbliche),
// questa eredita il layout (protected) quindi sidebar e header restano
// visibili — l'utente non si trova bloccato in una pagina senza nav.

import Link from "next/link";

export default function ProtectedNotFound() {
 return (
 <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center">
 <h1 className="text-5xl font-bold text-text">404</h1>
 <h2 className="text-xl font-semibold text-text">Pagina non trovata</h2>
 <p className="text-sm text-text-muted">
 L&apos;indirizzo che hai aperto non esiste o &egrave; stato spostato. Usa il menu a
 sinistra per continuare, oppure torna alla home.
 </p>
 <Link
 href="/oggi"
 className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
 >
 Vai a Oggi
 </Link>
 </div>
 );
}
