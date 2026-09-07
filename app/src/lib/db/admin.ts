// RS-2: unico punto di creazione del client con service_role.
// SOLO lato server, MAI passato al browser. Usato per audit log, seed, jobs
// che devono bypassare RLS. Nessun endpoint pubblico deve chiamarlo con input
// utente non validato.

import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | undefined;

export function getAdminClient() {
  if (cached) return cached;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata (usarla solo lato server).");
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
