// RF-8.4 Review classified 'serious' non ha mai suggested_reply dopo fetch+classify.

import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { fetchAllBrandsReviews } from "@/modules/m08-reviews/internal/reviews-fetcher";
import { MockGooglePlacesAdapter } from "@/modules/m08-reviews/internal/google-places-adapter";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const admin: SupabaseClient = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const TEST_PLACE = `test-serious-${Date.now()}`;

describe("RF-8.4 · M08 serious senza bozza automatica", () => {
  let brandId: string;
  let origPlaceId: string | null;

  beforeAll(async () => {
    const { data: b } = await admin
      .from("brands")
      .select("id, google_place_id")
      .eq("organization_id", ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    brandId = (b as { id: string }).id;
    origPlaceId = (b as { google_place_id: string | null }).google_place_id;
    await admin.from("brands").update({ google_place_id: TEST_PLACE }).eq("id", brandId);
  });

  afterAll(async () => {
    await admin.from("reviews").delete().eq("brand_id", brandId);
    await admin.from("brands").update({ google_place_id: origPlaceId }).eq("id", brandId);
  });

  it("review rating 5 ma testo 'avvocato' → status=serious_signaled, suggested_reply NULL", async () => {
    const adapter = new MockGooglePlacesAdapter({
      [TEST_PLACE]: [
        {
          externalId: `${TEST_PLACE}:serious-1`,
          authorName: "Carla",
          rating: 5,
          text: "Chiamo il mio avvocato",
          postedAt: new Date().toISOString(),
        },
      ],
    });
    await fetchAllBrandsReviews(ORG_ID, adapter);

    const { data } = await admin
      .from("reviews")
      .select("status, suggested_reply, classification")
      .eq("brand_id", brandId)
      .eq("author_name", "Carla")
      .maybeSingle();
    expect((data as { classification: string }).classification).toBe("serious");
    expect((data as { status: string }).status).toBe("serious_signaled");
    expect((data as { suggested_reply: string | null }).suggested_reply).toBeNull();
  });
});
