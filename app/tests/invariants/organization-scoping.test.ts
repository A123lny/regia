import { describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata. Carica app/.env.local prima dei test.");
}

const admin: SupabaseClient = createClient(url, serviceKey);

describe("RN-87 · organization_id obbligatorio su brands", () => {
  it("rifiuta l'inserimento di un brand senza organization_id", async () => {
    const { error } = await admin
      .from("brands")
      .insert({ slug: "test-no-org", display_name: "Test senza org" });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/organization_id|not-null|null value/);
  });

  it("accetta l'inserimento di un brand con organization_id valido", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const slug = `test-ok-${Date.now()}`;
    const { data, error } = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug, display_name: "Test OK" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.organization_id).toBe(orgId);
    // cleanup
    await admin.from("brands").delete().eq("slug", slug);
  });
});
