// RS-3 RN-87: setDraftImage filtra su organization_id — IDOR bloccato.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { setDraftImage } from "@/modules/m03-editorial/internal/content-drafts-repo";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("setDraftImage: tenant scoping IDOR (RS-3, RN-87)", () => {
  let draftIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — image scoping" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A fallito: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — image scoping" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B fallito: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-img-${orgAId.slice(0, 8)}`,
        display_name: "Brand A Img",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data)
      throw new Error(`Setup brand-A fallito: ${brandA.error?.message}`);
    const brandIdOrgA = (brandA.data as { id: string }).id;

    const draft = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgAId,
        brand_id: brandIdOrgA,
        channel: "social",
        theme_input: "test img scoping",
        generated_text: "testo",
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
    if (draft.error || !draft.data) throw new Error(`Setup draft fallito: ${draft.error?.message}`);
    draftIdOrgA = (draft.data as { id: string }).id;
  });

  const validImageData = {
    url: "test/img.jpg",
    prompt: "test prompt",
    model: "flux-dev",
    costUsd: 0.025,
    generatedAt: new Date().toISOString(),
  };

  it("setDraftImage(draftIdOrgA, orgBId, ...) → null (IDOR bloccato)", async () => {
    const result = await setDraftImage(draftIdOrgA, orgBId, validImageData);
    expect(result).toBeNull();
  });

  it("setDraftImage(draftIdOrgA, orgAId, ...) → ContentDraft (accesso legittimo)", async () => {
    const result = await setDraftImage(draftIdOrgA, orgAId, validImageData);
    expect(result).not.toBeNull();
    expect(result?.imageUrl).toBe("test/img.jpg");
    expect(result?.imagePrompt).toBe("test prompt");
    expect(result?.imageModel).toBe("flux-dev");
    expect(result?.imageCostUsd).toBe(0.025);
    expect(result?.organizationId).toBe(orgAId);
  });
});
