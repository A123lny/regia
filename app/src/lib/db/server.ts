// RS-2: unico punto di creazione del client Supabase lato server (RSC, route handler, server action).
// Legge/scrive i cookie di sessione secondo il pattern ufficiale @supabase/ssr.
//
// Next 16: cookieStore.set() lancia se chiamato durante il render di un Server Component.
// Pattern ufficiale @supabase/ssr: try/catch silenzioso su setAll — il refresh dei cookie
// è comunque garantito dal middleware (src/middleware.ts + src/lib/db/middleware.ts), che
// gira in Edge runtime dove la scrittura cookie è consentita.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY non impostate.");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chiamata da un Server Component: il middleware ha già rinfrescato i cookie.
        }
      },
    },
  });
}
