import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");

const admin: SupabaseClient = createClient(url, serviceKey);

async function brandId(slug: string): Promise<string> {
  const { data } = await admin.from("brands").select("id").eq("slug", slug).single();
  if (!data) throw new Error(`brand ${slug} non trovato`);
  return data.id as string;
}

describe("RF-2.5 · brand_forbidden_words unique case-insensitive per marchio", () => {
  it("rifiuta duplicati esatti nella stessa marca", async () => {
    const lennyId = await brandId("lenny");
    const word = `test-dup-${Date.now()}`;
    const first = await admin.from("brand_forbidden_words").insert({ brand_id: lennyId, word });
    expect(first.error).toBeNull();
    const second = await admin.from("brand_forbidden_words").insert({ brand_id: lennyId, word });
    expect(second.error).not.toBeNull();
    expect(second.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
    // cleanup
    await admin.from("brand_forbidden_words").delete().eq("brand_id", lennyId).eq("word", word);
  });

  it("rifiuta duplicati case-insensitive (Aziendalese vs aziendalese)", async () => {
    const lennyId = await brandId("lenny");
    const wordLower = `test-ci-${Date.now()}`;
    const wordUpper = wordLower.toUpperCase();
    const first = await admin
      .from("brand_forbidden_words")
      .insert({ brand_id: lennyId, word: wordLower });
    expect(first.error).toBeNull();
    const second = await admin
      .from("brand_forbidden_words")
      .insert({ brand_id: lennyId, word: wordUpper });
    expect(second.error).not.toBeNull();
    expect(second.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
    await admin
      .from("brand_forbidden_words")
      .delete()
      .eq("brand_id", lennyId)
      .eq("word", wordLower);
  });

  it("accetta la stessa parola in marchi diversi (unique per brand_id)", async () => {
    const lennyId = await brandId("lenny");
    const stazioneId = await brandId("stazione");
    const word = `test-multibrand-${Date.now()}`;
    const a = await admin.from("brand_forbidden_words").insert({ brand_id: lennyId, word });
    const b = await admin.from("brand_forbidden_words").insert({ brand_id: stazioneId, word });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    await admin.from("brand_forbidden_words").delete().eq("word", word);
  });
});
