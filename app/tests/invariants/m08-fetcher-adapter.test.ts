// RS-2 Adapter Google Places + fetcher idempotente.
// Usa MockGooglePlacesAdapter per non chiamare Google in test.

import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { fetchAllBrandsReviews } from "@/modules/m08-reviews/internal/reviews-fetcher";
import { MockGooglePlacesAdapter } from "@/modules/m08-reviews/internal/google-places-adapter";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");
const admin: SupabaseClient = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const TEST_PLACE_ID = `test-place-${Date.now()}`;

describe("RS-2 · M08 fetcher idempotente con MockGooglePlacesAdapter", () => {
  let brandId: string;
  let origPlaceId: string | null;

  beforeAll(async () => {
    const { data: brand } = await admin
      .from("brands")
      .select("id, google_place_id")
      .eq("organization_id", ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    brandId = (brand as { id: string; google_place_id: string | null }).id;
    origPlaceId = (brand as { google_place_id: string | null }).google_place_id;
    await admin.from("brands").update({ google_place_id: TEST_PLACE_ID }).eq("id", brandId);
  });

  afterAll(async () => {
    await admin.from("reviews").delete().eq("brand_id", brandId);
    await admin.from("brands").update({ google_place_id: origPlaceId }).eq("id", brandId);
  });

  it("fetch con 2 review nuove → 2 inserite; re-fetch → 0 nuove (idempotenza)", async () => {
    const fixture = [
      {
        externalId: `${TEST_PLACE_ID}:1000:Mario`,
        authorName: "Mario",
        rating: 5,
        text: "Perfetto",
        postedAt: new Date().toISOString(),
      },
      {
        externalId: `${TEST_PLACE_ID}:2000:Luigi`,
        authorName: "Luigi",
        rating: 2,
        text: "Male",
        postedAt: new Date().toISOString(),
      },
    ];
    const adapter = new MockGooglePlacesAdapter({ [TEST_PLACE_ID]: fixture });

    const first = await fetchAllBrandsReviews(ORG_ID, adapter);
    expect(first.brandsScanned).toBeGreaterThanOrEqual(1);
    expect(first.newInserted).toBe(2);

    const second = await fetchAllBrandsReviews(ORG_ID, adapter);
    expect(second.reviewsFetched).toBe(2);
    expect(second.newInserted).toBe(0);
  });

  it("classifica correttamente al fetch: rating 5 'allergia' → serious + status='serious_signaled'", async () => {
    const fixture = [
      {
        externalId: `${TEST_PLACE_ID}:3000:Carla`,
        authorName: "Carla",
        rating: 5,
        text: "ho avuto una brutta allergia",
        postedAt: new Date().toISOString(),
      },
    ];
    const adapter = new MockGooglePlacesAdapter({ [TEST_PLACE_ID]: fixture });
    await fetchAllBrandsReviews(ORG_ID, adapter);

    const { data } = await admin
      .from("reviews")
      .select("classification, status, suggested_reply")
      .eq("brand_id", brandId)
      .eq("author_name", "Carla")
      .maybeSingle();
    expect((data as { classification: string }).classification).toBe("serious");
    expect((data as { status: string }).status).toBe("serious_signaled");
    expect((data as { suggested_reply: string | null }).suggested_reply).toBeNull();
  });
});
