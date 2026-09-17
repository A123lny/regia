import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const ANON_KEY = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("content_drafts: RLS denial-by-default (RS-3, RN-87)", () => {
  let brandId: string;
  let draftId: string;

  beforeAll(async () => {
    const b = await admin.from("brands").select("id").eq("slug", "lenny").maybeSingle();
    brandId = (b.data as { id: string }).id;

    // Inserisci draft via service_role (deve funzionare)
    const { data, error } = await admin
      .from("content_drafts")
      .insert({
        organization_id: SEED_ORG_ID,
        brand_id: brandId,
        channel: "social",
        theme_input: "test rls",
        generated_text: "test",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        created_by: null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Setup fallito: ${error?.message}`);
    draftId = data.id;
  });

  it("service_role legge i draft (bypass RLS)", async () => {
    const { data, error } = await admin
      .from("content_drafts")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(draftId);
  });

  it("anon key NON legge i draft (RLS chiuso)", async () => {
    const { data } = await anon.from("content_drafts").select("id").eq("id", draftId);
    // Con RLS enabled + revoke all, Postgres restituisce permission denied (error non null).
    // Con RLS enabled senza revoke, Postgres restituisce 0 rows (error null, data []).
    // In entrambi i casi l'invariante è: nessun dato esposto ad anon.
    const rows = data ?? [];
    expect(rows).toEqual([]); // nessuna riga trapelata
  });

  it("anon key NON inserisce (RLS chiuso)", async () => {
    const { error } = await anon.from("content_drafts").insert({
      organization_id: SEED_ORG_ID,
      brand_id: brandId,
      channel: "social",
      theme_input: "hack",
      generated_text: "hack",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      created_by: null,
    });
    expect(error).toBeTruthy();
    // Cleanup se per errore è passato
  });
});
