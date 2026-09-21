// RS-3 §4.2: CHECK individuali su image_prompt (length 1..2000), image_model (enum), image_cost_usd (>=0).
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_drafts: CHECK individuali su colonne image_* (RS-3)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — image column checks" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-img-col-${orgId.slice(0, 8)}`,
        display_name: "Brand Image Col",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  const withImage = (overrides: Record<string, unknown>) => ({
    organization_id: orgId,
    brand_id: brandId,
    channel: "social",
    theme_input: "test image col",
    generated_text: "testo",
    prompt_version: "v1",
    model_used: "m",
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    image_url: `${orgId}/test-col.jpg`,
    image_prompt: "valid prompt",
    image_model: "flux-dev",
    image_cost_usd: 0.025,
    image_generated_at: new Date().toISOString(),
    ...overrides,
  });

  it("image_prompt vuoto fallisce CHECK length", async () => {
    const res = await admin.from("content_drafts").insert(withImage({ image_prompt: "" }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_prompt_length|check/);
  });

  it("image_prompt >2000 char fallisce CHECK length", async () => {
    const res = await admin
      .from("content_drafts")
      .insert(withImage({ image_prompt: "a".repeat(2001) }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_prompt_length|check/);
  });

  it("image_model non in enum fallisce CHECK", async () => {
    const res = await admin.from("content_drafts").insert(withImage({ image_model: "sdxl" }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_model_enum|check/);
  });

  it("image_cost_usd negativo fallisce CHECK", async () => {
    const res = await admin.from("content_drafts").insert(withImage({ image_cost_usd: -0.01 }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_cost_non_negative|check/);
  });
});
