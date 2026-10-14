// Helper admin per asserzioni e cleanup post-azione.
// NB: ricreato ad ogni test — niente stato condiviso.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
