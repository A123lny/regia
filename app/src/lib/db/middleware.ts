// RS-2: unico punto di creazione del client Supabase per il middleware Next.js.
// Il middleware non può usare `next/headers` (context non disponibile nell'Edge runtime),
// perciò questo wrapper accetta request/response e gestisce i cookie direttamente.
// Restituisce il client e l'aggiornamento della response: il middleware orchestra il ciclo,
// questo file conosce solo Supabase.

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Crea un client Supabase adatto al middleware Next.js e restituisce la response
 * (potenzialmente aggiornata con cookie di sessione rinnovati).
 *
 * Il chiamante (src/middleware.ts) deve usare la response restituita — non quella
 * creata con NextResponse.next() prima della chiamata — per propagare i cookie.
 */
export function getMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  if (!url || !key) {
    // Env vars mancanti: lascia passare la richiesta senza autenticazione Supabase.
    return { supabase: null, response };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
}
