import { describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata. Carica app/.env.local prima dei test.");
}

const admin: SupabaseClient = createClient(url, serviceKey);

const ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("RF-11.3 · audit_events è append-only", () => {
  it("permette l'insert di un evento", async () => {
    const action = `test.insert.${Date.now()}`;
    const { data, error } = await admin
      .from("audit_events")
      .insert({
        organization_id: ORG_ID,
        actor_user_id: null,
        actor_kind: "system",
        action,
        details: { note: "test" },
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.action).toBe(action);
  });

  it("rifiuta ogni UPDATE su audit_events", async () => {
    // Prima inserisci una riga da tentare di modificare
    const action = `test.to-update.${Date.now()}`;
    const { data: inserted } = await admin
      .from("audit_events")
      .insert({
        organization_id: ORG_ID,
        actor_kind: "system",
        action,
      })
      .select()
      .single();
    expect(inserted).toBeTruthy();

    const { error } = await admin
      .from("audit_events")
      .update({ action: "test.modified" })
      .eq("id", inserted!.id);
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/audit.*append-only|permission|denied|immutab/);
  });

  it("rifiuta ogni DELETE su audit_events", async () => {
    const action = `test.to-delete.${Date.now()}`;
    const { data: inserted } = await admin
      .from("audit_events")
      .insert({
        organization_id: ORG_ID,
        actor_kind: "system",
        action,
      })
      .select()
      .single();
    expect(inserted).toBeTruthy();

    const { error } = await admin.from("audit_events").delete().eq("id", inserted!.id);
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/audit.*append-only|permission|denied|immutab/);
  });
});
