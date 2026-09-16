import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");

const admin: SupabaseClient = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function brandId(slug: string): Promise<string> {
  const { data } = await admin.from("brands").select("id").eq("slug", slug).single();
  if (!data) throw new Error(`brand ${slug} non trovato`);
  return data.id as string;
}

describe("RF-2.3 · seed brand_kits per i 4 marchi", () => {
  it("i 4 marchi hanno brand_kit con tono non vuoto", async () => {
    const { data } = await admin
      .from("brand_kits")
      .select("brand_id, tone_of_voice, strategic_purpose");
    expect(data).toHaveLength(4);
    for (const row of data ?? []) {
      expect((row.tone_of_voice as string).length).toBeGreaterThan(20);
      expect((row.strategic_purpose as string).length).toBeGreaterThan(20);
    }
  });

  it("Lenny ha almeno 4 pillars con pesi validi", async () => {
    const lennyId = await brandId("lenny");
    const { data } = await admin
      .from("brand_pillars")
      .select("name, weight")
      .eq("brand_id", lennyId);
    expect((data ?? []).length).toBeGreaterThanOrEqual(4);
    for (const row of data ?? []) {
      const w = row.weight as number;
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(10);
    }
  });

  it("tutti i 4 marchi hanno almeno 5 parole bandite (aziendalese default)", async () => {
    for (const slug of ["lenny", "stazione", "eni-cafe", "officina"]) {
      const bid = await brandId(slug);
      const { data } = await admin.from("brand_forbidden_words").select("word").eq("brand_id", bid);
      expect((data ?? []).length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("RS-3 · brand_kit cascade delete su brand delete", () => {
  it("delete di un brand cascada su brand_kits, pillars, forbidden_words, sensitive_topics", async () => {
    // Crea un brand di test
    const { data: newBrand, error: e0 } = await admin
      .from("brands")
      .insert({
        organization_id: ORG_ID,
        slug: `test-cascade-${Date.now()}`,
        display_name: "Test Cascade",
      })
      .select()
      .single();
    expect(e0).toBeNull();
    const testId = newBrand!.id as string;

    // Popola brand_kits + pillar + forbidden_word + sensitive_topic
    await admin.from("brand_kits").insert({ brand_id: testId, tone_of_voice: "test" });
    await admin.from("brand_pillars").insert({ brand_id: testId, name: "p1", weight: 5 });
    await admin.from("brand_forbidden_words").insert({ brand_id: testId, word: "w1" });
    await admin.from("brand_sensitive_topics").insert({
      brand_id: testId,
      topic: "t1",
      kind: "revisione_umana",
    });

    // Delete brand
    const { error: eDel } = await admin.from("brands").delete().eq("id", testId);
    expect(eDel).toBeNull();

    // Verifica cascade
    const kit = await admin.from("brand_kits").select("brand_id").eq("brand_id", testId);
    const pillars = await admin.from("brand_pillars").select("id").eq("brand_id", testId);
    const forb = await admin.from("brand_forbidden_words").select("id").eq("brand_id", testId);
    const sens = await admin.from("brand_sensitive_topics").select("id").eq("brand_id", testId);

    expect(kit.data).toEqual([]);
    expect(pillars.data).toEqual([]);
    expect(forb.data).toEqual([]);
    expect(sens.data).toEqual([]);
  });
});
