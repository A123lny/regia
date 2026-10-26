// RF-8.1 M08 fetcher idempotente: UNIQUE (organization_id, source, external_id)
// garantisce che re-fetch della stessa review non duplichi la riga.

import { describe, expect, it, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");
const admin: SupabaseClient = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("RS-3 · M08 reviews dedup fetcher", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await admin.from("reviews").delete().eq("id", id);
    }
  });

  it("INSERT stessa (org, source, external_id) due volte → unique violation", async () => {
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    const brandId = (brand as { id: string }).id;
    const externalId = `test-dedup-${Date.now()}`;

    const row = {
      organization_id: ORG_ID,
      brand_id: brandId,
      source: "google",
      external_id: externalId,
      author_name: "Mario",
      rating: 5,
      text_original: "Ottimo",
      posted_at: new Date().toISOString(),
      classification: "positive" as const,
    };

    const { data: first } = await admin.from("reviews").insert(row).select("id").single();
    createdIds.push((first as { id: string }).id);

    const { error: second } = await admin.from("reviews").insert(row);
    expect(second).not.toBeNull();
    expect(second?.code).toBe("23505");
  });

  it("INSERT stesso external_id ma brand diverso → unique violation", async () => {
    const { data: brandsData } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", ORG_ID)
      .limit(2);
    const brands = brandsData as { id: string }[];
    expect(brands).toBeDefined();
    expect(brands.length).toBeGreaterThanOrEqual(2);
    const brandA = brands[0];
    const brandB = brands[1];
    expect(brandB).toBeDefined();

    const externalId = `test-cross-brand-${Date.now()}`;
    const base = {
      organization_id: ORG_ID,
      source: "google",
      external_id: externalId,
      author_name: "Mario",
      rating: 5,
      text_original: "Ottimo",
      posted_at: new Date().toISOString(),
      classification: "positive" as const,
    };

    const { data: a } = await admin
      .from("reviews")
      .insert({ ...base, brand_id: brandA!.id })
      .select("id")
      .single();
    createdIds.push((a as { id: string }).id);

    const { error: b } = await admin
      .from("reviews")
      .insert({ ...base, brand_id: brandB!.id });
    expect(b).not.toBeNull();
    expect(b?.code).toBe("23505");
  });

  it("INSERT con rating fuori range (0 o 6) → check violation", async () => {
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    const brandId = (brand as { id: string }).id;

    const base = {
      organization_id: ORG_ID,
      brand_id: brandId,
      source: "google",
      external_id: `test-check-${Date.now()}`,
      author_name: "Mario",
      text_original: "Ottimo",
      posted_at: new Date().toISOString(),
      classification: "positive" as const,
    };

    const { error: e0 } = await admin.from("reviews").insert({ ...base, rating: 0 });
    expect(e0?.code).toBe("23514");

    const { error: e6 } = await admin
      .from("reviews")
      .insert({ ...base, rating: 6, external_id: `test-check-6-${Date.now()}` });
    expect(e6?.code).toBe("23514");
  });
});
