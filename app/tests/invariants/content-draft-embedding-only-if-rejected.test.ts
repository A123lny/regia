import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

const zeroVec512 = Array.from({ length: 512 }, () => 0);

describe("content_drafts: embedding solo se rejected (RS-3, RF-3.8)", () => {
  let brandId: string;
  beforeAll(async () => {
    const b = await admin.from("brands").select("id").eq("slug", "lenny").maybeSingle();
    brandId = (b.data as { id: string }).id;
  });

  it("rifiuta rejection_reason_embedding su draft con status=draft", async () => {
    const { error } = await admin.from("content_drafts").insert({
      organization_id: SEED_ORG_ID,
      brand_id: brandId,
      channel: "social",
      theme_input: "t",
      generated_text: "p",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "draft",
      rejection_reason_embedding: zeroVec512 as unknown as string,
      created_by: null,
    });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/rejection_embedding_only_if_rejected/i);
  });

  it("accetta rejection_reason_embedding su draft con status=rejected", async () => {
    const { data, error } = await admin
      .from("content_drafts")
      .insert({
        organization_id: SEED_ORG_ID,
        brand_id: brandId,
        channel: "social",
        theme_input: "t",
        generated_text: "p",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: "motivo",
        rejection_reason_embedding: zeroVec512 as unknown as string,
        created_by: null,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data?.id) await admin.from("content_drafts").delete().eq("id", data.id);
  });
});
