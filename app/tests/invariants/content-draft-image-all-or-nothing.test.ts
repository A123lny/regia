// RS-3 §4.2: CHECK image_all_or_nothing — tutti e 5 i campi image_* valorizzati insieme o tutti NULL.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_drafts: CHECK image_all_or_nothing (RS-3)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — image all-or-nothing" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-img-aon-${orgId.slice(0, 8)}`,
        display_name: "Brand Image AON",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  const baseDraft = () => ({
    organization_id: orgId,
    brand_id: brandId,
    channel: "social",
    theme_input: "test image aon",
    generated_text: "testo",
    prompt_version: "v1",
    model_used: "m",
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
  });

  it("stato parziale (solo image_url valorizzato) fallisce CHECK", async () => {
    const res = await admin.from("content_drafts").insert({
      ...baseDraft(),
      image_url: "test/path.jpg",
      image_prompt: null,
      image_model: null,
      image_cost_usd: null,
      image_generated_at: null,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_all_or_nothing|check/);
  });

  it("tutti i campi image_* NULL riesce (draft senza immagine)", async () => {
    const res = await admin.from("content_drafts").insert(baseDraft()).select("id").single();
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });

  it("tutti i campi image_* valorizzati riesce", async () => {
    const res = await admin
      .from("content_drafts")
      .insert({
        ...baseDraft(),
        image_url: `${orgId}/test-aon.jpg`,
        image_prompt: "test prompt",
        image_model: "flux-dev",
        image_cost_usd: 0.025,
        image_generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });
});
