import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

async function getFixtureIds(): Promise<{ brandId: string }> {
  const brand = await admin.from("brands").select("id").eq("slug", "lenny").maybeSingle();
  if (brand.error || !brand.data) throw new Error("Fixture brand lenny mancante");
  return { brandId: (brand.data as { id: string }).id };
}

describe("content_drafts: coerenza status ↔ timestamps (RS-3)", () => {
  let brandId: string;

  beforeAll(async () => {
    ({ brandId } = await getFixtureIds());
  });

  it("rifiuta status=approved senza approved_at", async () => {
    const { error } = await admin.from("content_drafts").insert({
      organization_id: SEED_ORG_ID,
      brand_id: brandId,
      channel: "social",
      theme_input: "test",
      generated_text: "test",
      prompt_version: "v1",
      model_used: "test",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "approved",
      created_by: null,
      // approved_at MANCA
    });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/approved_has_timestamp/i);
  });

  it("rifiuta status=rejected senza rejected_at e rejection_reason", async () => {
    const { error } = await admin.from("content_drafts").insert({
      organization_id: SEED_ORG_ID,
      brand_id: brandId,
      channel: "social",
      theme_input: "test",
      generated_text: "test",
      prompt_version: "v1",
      model_used: "test",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "rejected",
      created_by: null,
      // rejected_at e rejection_reason MANCANO
    });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/rejected_has_timestamp_and_reason/i);
  });

  it("accetta status=draft (default) senza timestamp", async () => {
    const { data, error } = await admin
      .from("content_drafts")
      .insert({
        organization_id: SEED_ORG_ID,
        brand_id: brandId,
        channel: "social",
        theme_input: "test valido",
        generated_text: "post valido",
        prompt_version: "v1",
        model_used: "claude-sonnet-4-6",
        tokens_in: 100,
        tokens_out: 50,
        cost_usd: 0.001,
        latency_ms: 500,
        created_by: null,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    // pulizia
    if (data?.id) await admin.from("content_drafts").delete().eq("id", data.id);
  });
});
