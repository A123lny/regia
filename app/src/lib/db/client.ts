// RS-2: unico punto di creazione del client Supabase lato browser.
// Nessun altro file dell'applicazione deve importare @supabase/supabase-js direttamente.

import { createBrowserClient } from "@supabase/ssr";

export function getBrowserClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY non impostate.");
  }
  return createBrowserClient(url, key);
}
