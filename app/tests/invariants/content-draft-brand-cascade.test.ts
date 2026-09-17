import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("content_drafts: FK brand cascade delete (RS-3)", () => {
  it("elimina i draft quando il brand viene eliminato", async () => {
    // Crea brand test isolato
    const { data: brand } = await admin
      .from("brands")
      .insert({
        organization_id: SEED_ORG_ID,
        slug: "test-cascade-brand",
        display_name: "Test Cascade Brand",
      })
      .select("id")
      .single();
    if (!brand) throw new Error("Setup brand fallito");

    // Crea 2 draft su questo brand
    await admin.from("content_drafts").insert([
      {
        organization_id: SEED_ORG_ID,
        brand_id: brand.id,
        channel: "social",
        theme_input: "t1",
        generated_text: "p1",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        created_by: null,
      },
      {
        organization_id: SEED_ORG_ID,
        brand_id: brand.id,
        channel: "social",
        theme_input: "t2",
        generated_text: "p2",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        created_by: null,
      },
    ]);

    const before = await admin
      .from("content_drafts")
      .select("id", { count: "exact" })
      .eq("brand_id", brand.id);
    expect(before.count).toBe(2);

    // Elimina brand → cascade
    await admin.from("brands").delete().eq("id", brand.id);

    const after = await admin
      .from("content_drafts")
      .select("id", { count: "exact" })
      .eq("brand_id", brand.id);
    expect(after.count).toBe(0);
  });
});
