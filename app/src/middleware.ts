// RS-6: pattern canonico Supabase SSR per Next.js.
// Rinfresca la sessione cookie ad ogni navigazione — senza questo, il JWT scade dopo 1h
// e l'utente viene disconnesso silenziosamente. Il client Supabase è creato tramite
// lib/db/middleware.ts (RS-2: un solo punto di accesso per contesto di esecuzione).

import type { NextRequest } from "next/server";
import { getMiddlewareClient } from "@/lib/db/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = getMiddlewareClient(request);

  if (supabase) {
    // IMPORTANTE: usare getUser(), non getSession().
    // getSession() legge solo il cookie locale e non valida il token sul server.
    // getUser() chiama l'API Supabase e garantisce che il token sia valido e rinnovato.
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    // Applica il middleware a tutte le route eccetto:
    // - file statici Next.js (_next/static, _next/image)
    // - favicon e immagini comuni (svg, png, jpg, jpeg, gif, webp)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
