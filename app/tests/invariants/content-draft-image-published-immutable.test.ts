// RF-5.7: draft in stato 'published' → immagine immutabile.
// Repo functions setDraftImage e clearDraftImage devono ritornare null (defensive status guard T4).
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  setDraftImage,
  clearDraftImage,
} from "@/modules/m03-editorial/internal/content-drafts-repo";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("Repo image: draft published immutable (RF-5.7)", () => {
  let draftIdPublished: string;
  let orgId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — image published immut" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-pub-immut-${orgId.slice(0, 8)}`,
        display_name: "Brand Pub Immut",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    const brandId = (brand.data as { id: string }).id;

    const approvedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const scheduledAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const publishedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const draft = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        channel: "social",
        theme_input: "test published immutable image",
        generated_text: "testo pubblicato",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "published",
        approved_at: approvedAt.toISOString(),
        scheduled_at: scheduledAt.toISOString(),
        published_at: publishedAt.toISOString(),
        created_by: null,
      })
      .select("id")
      .single();
    if (draft.error || !draft.data)
      throw new Error(`Setup draft published fallito: ${draft.error?.message}`);
    draftIdPublished = (draft.data as { id: string }).id;
  });

  it("setDraftImage su draft 'published' → null (status guard defensive)", async () => {
    const result = await setDraftImage(draftIdPublished, orgId, {
      url: "test/path.jpg",
      prompt: "test prompt",
      model: "flux-dev",
      costUsd: 0.025,
      generatedAt: new Date().toISOString(),
    });
    expect(result).toBeNull();
  });

  it("clearDraftImage su draft 'published' → null (status guard defensive)", async () => {
    const result = await clearDraftImage(draftIdPublished, orgId);
    expect(result).toBeNull();
  });
});
