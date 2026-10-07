// RS-6: pattern canonico Supabase SSR per Next.js 16.
// Next.js 16 ha rinominato `middleware` -> `proxy` (stesso comportamento, nome
// piu' chiaro). Rinfresca la sessione cookie ad ogni navigazione — senza questo,
// il JWT scade dopo 1h e l'utente viene disconnesso silenziosamente. Il client
// Supabase e' creato tramite lib/db/middleware.ts (RS-2: un solo punto di accesso).
//
// RF-12.1: best-effort auth refresh — il proxy NON deve mai bloccare una request.
// Il login (server action React 19 come multipart/form-data) passa da qui: se
// getUser() e' lento o fallisce, il try/catch + timeout assicura che la response
// venga comunque restituita. Se il token e' davvero scaduto lo gestira'
// getSessionOrRedirect lato pagina.

import type { NextRequest } from "next/server";
import { getMiddlewareClient } from "@/lib/db/middleware";

export async function proxy(request: NextRequest) {
  const { supabase, response } = getMiddlewareClient(request);

  if (supabase) {
    // IMPORTANTE: usare getUser(), non getSession().
    // getSession() legge solo il cookie locale e non valida il token sul server.
    // getUser() chiama l'API Supabase e garantisce che il token sia valido e rinnovato.
    //
    // Best-effort: timeout 2 s + catch silenzioso.
    // Un errore qui NON deve impedire al server action o alla pagina di rispondere.
    try {
      await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("proxy auth timeout")), 2000),
        ),
      ]);
    } catch {
      // Silenzioso di proposito: proxy best-effort.
      // Se il token è davvero scaduto, sarà getSessionOrRedirect a gestirlo lato pagina protetta.
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Applica il proxy a tutte le route eccetto:
    // - file statici Next.js (_next/static, _next/image)
    // - favicon e immagini comuni (svg, png, jpg, jpeg, gif, webp)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
