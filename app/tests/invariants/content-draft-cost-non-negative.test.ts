import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("content_drafts: costi e tokens non negativi (RS-3)", () => {
  let brandId: string;
  beforeAll(async () => {
    const b = await admin.from("brands").select("id").eq("slug", "lenny").maybeSingle();
    brandId = (b.data as { id: string }).id;
  });

  const baseValid = {
    organization_id: SEED_ORG_ID,
    channel: "social" as const,
    theme_input: "t",
    generated_text: "p",
    prompt_version: "v1",
    model_used: "m",
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    created_by: null,
  };

  it("rifiuta cost_usd negativo", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...baseValid,
      brand_id: brandId,
      cost_usd: -0.01,
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("cost_usd");
  });

  it("rifiuta tokens_in negativo", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...baseValid,
      brand_id: brandId,
      tokens_in: -1,
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("tokens_in");
  });

  it("rifiuta latency_ms negativo", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...baseValid,
      brand_id: brandId,
      latency_ms: -1,
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("latency_ms");
  });
});
