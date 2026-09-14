import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata. Carica app/.env.local prima dei test.");
}

const admin: SupabaseClient = createClient(url, serviceKey);

async function getLennyId(): Promise<string> {
  const { data } = await admin.from("brands").select("id").eq("slug", "lenny").single();
  if (!data) throw new Error("Brand 'lenny' non trovato nel seed");
  return data.id as string;
}

describe("RF-2.4 · brand_pillars weight tra 1 e 10", () => {
  it("rifiuta weight = 0", async () => {
    const lennyId = await getLennyId();
    const name = `test-w0-${Date.now()}`;
    const { error } = await admin
      .from("brand_pillars")
      .insert({ brand_id: lennyId, name, weight: 0 });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/weight_range|check|violates/);
  });

  it("rifiuta weight = 11", async () => {
    const lennyId = await getLennyId();
    const name = `test-w11-${Date.now()}`;
    const { error } = await admin
      .from("brand_pillars")
      .insert({ brand_id: lennyId, name, weight: 11 });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/weight_range|check|violates/);
  });

  it("accetta weight = 1 (minimo)", async () => {
    const lennyId = await getLennyId();
    const name = `test-w1-${Date.now()}`;
    const { error } = await admin
      .from("brand_pillars")
      .insert({ brand_id: lennyId, name, weight: 1 });
    expect(error).toBeNull();
    await admin.from("brand_pillars").delete().eq("brand_id", lennyId).eq("name", name);
  });

  it("accetta weight = 10 (massimo)", async () => {
    const lennyId = await getLennyId();
    const name = `test-w10-${Date.now()}`;
    const { error } = await admin
      .from("brand_pillars")
      .insert({ brand_id: lennyId, name, weight: 10 });
    expect(error).toBeNull();
    await admin.from("brand_pillars").delete().eq("brand_id", lennyId).eq("name", name);
  });
});
