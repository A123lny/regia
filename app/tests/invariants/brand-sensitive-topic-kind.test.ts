import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");

const admin: SupabaseClient = createClient(url, serviceKey);

async function getLennyId(): Promise<string> {
  const { data } = await admin.from("brands").select("id").eq("slug", "lenny").single();
  if (!data) throw new Error("brand lenny non trovato");
  return data.id as string;
}

describe("RF-2.5 · brand_sensitive_topics kind enum", () => {
  it("accetta kind='claim_vietato'", async () => {
    const lennyId = await getLennyId();
    const topic = `test-claim-${Date.now()}`;
    const { error } = await admin
      .from("brand_sensitive_topics")
      .insert({ brand_id: lennyId, topic, kind: "claim_vietato" });
    expect(error).toBeNull();
    await admin.from("brand_sensitive_topics").delete().eq("brand_id", lennyId).eq("topic", topic);
  });

  it("accetta kind='revisione_umana'", async () => {
    const lennyId = await getLennyId();
    const topic = `test-rev-${Date.now()}`;
    const { error } = await admin
      .from("brand_sensitive_topics")
      .insert({ brand_id: lennyId, topic, kind: "revisione_umana" });
    expect(error).toBeNull();
    await admin.from("brand_sensitive_topics").delete().eq("brand_id", lennyId).eq("topic", topic);
  });

  it("rifiuta kind='altro' (fuori enum)", async () => {
    const lennyId = await getLennyId();
    const topic = `test-invalid-${Date.now()}`;
    const { error } = await admin
      .from("brand_sensitive_topics")
      .insert({ brand_id: lennyId, topic, kind: "altro" });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/kind_check|check|violates/);
  });
});
