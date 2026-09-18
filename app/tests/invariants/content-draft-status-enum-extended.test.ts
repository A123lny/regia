// RS-3 RF-3.5: enum content_draft_status esteso con 'scheduled' e 'published'.
// Test indirect: verifica che INSERT con questi valori enum NON fallisca per
// "invalid input value for enum" (T3 aggiungerà colonne+CHECK, ma quello di
// cui abbiamo bisogno qui è solo che l'enum accetti i nuovi valori).
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_draft_status: enum esteso con scheduled+published (RF-3.5)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — enum extended" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-enum-${orgId.slice(0, 8)}`,
        display_name: "Brand Enum Test",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  it("INSERT status='scheduled' non fallisce per enum invalid", async () => {
    // NOTA: questo INSERT fallirà per CHECK constraint (T3 gestirà i timestamp).
    // L'importante è che NON fallisca per "invalid input value for enum".
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test enum scheduled",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "scheduled",
    });
    // Enum esteso → INSERT non fallisce per enum, fallisce per qualcos'altro (CHECK, colonne).
    // Enum non esteso → error.message contiene "invalid input value for enum".
    if (res.error) {
      const errMsg = res.error.message.toLowerCase();
      expect(errMsg).not.toMatch(/invalid input value for enum/i);
    }
  });

  it("INSERT status='published' non fallisce per enum invalid", async () => {
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test enum published",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "published",
    });
    if (res.error) {
      const errMsg = res.error.message.toLowerCase();
      expect(errMsg).not.toMatch(/invalid input value for enum/i);
    }
  });
});
