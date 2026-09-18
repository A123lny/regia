// RS-3 RF-3.5: CHECK constraint su content_drafts per stati scheduled/published.
// - schedule_has_timestamp: status='scheduled' → scheduled_at NOT NULL
// - publish_has_timestamp: status='published' → published_at + scheduled_at NOT NULL
// - schedule_after_approve: scheduled_at deve essere > approved_at
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_drafts: CHECK invariants su scheduling (RS-3, RF-3.5)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — schedule invariants" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-sched-${orgId.slice(0, 8)}`,
        display_name: "Brand Schedule",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  it("schedule_has_timestamp: INSERT status='scheduled' con scheduled_at NULL fallisce", async () => {
    const approvedAt = new Date();
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test schedule check",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "scheduled",
      approved_at: approvedAt.toISOString(),
      scheduled_at: null,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/schedule_has_timestamp|check/);
  });

  it("publish_has_timestamp: INSERT status='published' senza published_at fallisce", async () => {
    const approvedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const scheduledAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test publish check",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "published",
      approved_at: approvedAt.toISOString(),
      scheduled_at: scheduledAt.toISOString(),
      published_at: null,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/publish_has_timestamp|check/);
  });

  it("schedule_after_approve: scheduled_at prima di approved_at fallisce", async () => {
    const approvedAt = new Date();
    const scheduledAt = new Date(approvedAt.getTime() - 60 * 1000); // 1min prima
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test schedule ordering",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "scheduled",
      approved_at: approvedAt.toISOString(),
      scheduled_at: scheduledAt.toISOString(),
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/schedule_after_approve|check/);
  });
});
