import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const SEED_ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("content_drafts: check lunghezze testi (RS-3)", () => {
  let brandId: string;
  beforeAll(async () => {
    const b = await admin.from("brands").select("id").eq("slug", "lenny").maybeSingle();
    brandId = (b.data as { id: string }).id;
  });

  const base = {
    organization_id: SEED_ORG_ID,
    channel: "social" as const,
    prompt_version: "v1",
    model_used: "m",
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    created_by: null,
  };

  it("rifiuta theme_input vuoto", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...base,
      brand_id: brandId,
      theme_input: "",
      generated_text: "ok",
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("theme_input");
  });

  it("rifiuta theme_input oltre 2000 char", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...base,
      brand_id: brandId,
      theme_input: "x".repeat(2001),
      generated_text: "ok",
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("theme_input");
  });

  it("rifiuta generated_text vuoto", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...base,
      brand_id: brandId,
      theme_input: "ok",
      generated_text: "",
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("generated_text");
  });

  it("rifiuta rejection_reason vuoto se presente", async () => {
    const { error } = await admin.from("content_drafts").insert({
      ...base,
      brand_id: brandId,
      theme_input: "ok",
      generated_text: "ok",
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: "",
    });
    expect(error).toBeTruthy();
    expect(error?.message.toLowerCase()).toContain("rejection_reason");
  });
});
