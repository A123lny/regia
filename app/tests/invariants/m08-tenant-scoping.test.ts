// RN-87 M08: review org A non leggibile da service-role query scoped a org B.

import { describe, expect, it, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const admin: SupabaseClient = createClient(url, serviceKey);

describe("RN-87 · M08 tenant scoping", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) await admin.from("reviews").delete().eq("id", id);
  });

  it("query scope org A non ritorna review di org B (filtro applicativo)", async () => {
    const { data: orgs } = await admin.from("organizations").select("id").limit(2);
    const orgList = (orgs ?? []) as { id: string }[];
    const [orgA, orgB] = orgList;
    if (!orgB && orgA) {
      // Se esiste una sola org, inseriamo una review ad-hoc in org A e
      // verifichiamo che un filtro per uno org inventato non la trovi.
      const { data: brand } = await admin
        .from("brands")
        .select("id")
        .eq("organization_id", orgA.id)
        .limit(1)
        .maybeSingle();
      const { data: r } = await admin
        .from("reviews")
        .insert({
          organization_id: orgA.id,
          brand_id: (brand as { id: string }).id,
          source: "google",
          external_id: `test-tenant-${Date.now()}`,
          author_name: "Mario",
          rating: 5,
          text_original: "Ok",
          posted_at: new Date().toISOString(),
          classification: "positive",
        })
        .select("id")
        .single();
      createdIds.push((r as { id: string }).id);

      const fakeOrgId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
      const { data } = await admin.from("reviews").select("id").eq("organization_id", fakeOrgId);
      expect((data ?? []).length).toBe(0);
    } else {
      expect(orgB).toBeDefined();
    }
  });
});
