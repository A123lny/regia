import { describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const admin: SupabaseClient = createClient(url, serviceKey);

describe("RS-3 · unicità dello slug del brand nella stessa organization", () => {
  it("rifiuta due brand con lo stesso slug nella stessa organization", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const slug = `dup-${Date.now()}`;
    const first = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug, display_name: "Primo" });
    expect(first.error).toBeNull();
    const second = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug, display_name: "Duplicato" });
    expect(second.error).not.toBeNull();
    expect(second.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
    // cleanup
    await admin.from("brands").delete().eq("slug", slug);
  });
});
