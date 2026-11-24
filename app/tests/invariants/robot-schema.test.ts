import { describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata. Carica app/.env.local prima dei test.");
}

const admin: SupabaseClient = createClient(url, serviceKey);

const ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("RN-robot T1 · schema robot_assistant", () => {
  it("robot_conversations esiste ed è leggibile da service_role", async () => {
    // RLS enabled è garantito dalla migrazione (ALTER TABLE ... ENABLE ROW LEVEL SECURITY).
    // Il service_role bypassa RLS: se la tabella esiste, la query va a buon fine.
    const { error } = await admin.from("robot_conversations").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("robot_role_access esiste ed è leggibile da service_role", async () => {
    const { error } = await admin.from("robot_role_access").select("role").limit(1);
    expect(error).toBeNull();
  });

  it("robot_conversations accetta insert con brand_id null", async () => {
    // Serve uno user_id valido su auth.users; usiamo il service_role per aggirare FK?
    // auth.users.id ha FK, quindi serve un user reale. Prendiamo il primo esistente.
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
    const userId = users?.users?.[0]?.id;
    if (!userId) {
      // Se il DB non ha utenti, skippa con messaggio esplicito
      console.warn("[robot-schema] nessun utente auth.users: test insert skipped");
      return;
    }

    const { data, error } = await admin
      .from("robot_conversations")
      .insert({
        user_id: userId,
        organization_id: ORG_ID,
        brand_id: null,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.brand_id).toBeNull();
    expect(data?.tool_calls_count).toBe(0);

    // Cleanup
    if (data?.id) {
      await admin.from("robot_conversations").delete().eq("id", data.id);
    }
  });

  it("robot_role_access ha esattamente 4 ruoli seed", async () => {
    const { data, error } = await admin.from("robot_role_access").select("role, enabled");
    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    const roles = (data ?? []).map((r) => r.role).sort();
    expect(roles).toEqual(["agent", "delegate", "editor", "owner"]);
    // Solo owner abilitato per default
    const owner = (data ?? []).find((r) => r.role === "owner");
    expect(owner?.enabled).toBe(true);
    const editor = (data ?? []).find((r) => r.role === "editor");
    expect(editor?.enabled).toBe(false);
  });

  it("robot_role_access rifiuta ruoli non validi (CHECK constraint)", async () => {
    const { error } = await admin
      .from("robot_role_access")
      .insert({ role: "supervisor", enabled: true });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/check|constraint|violat/);
  });

  it("ai_spend_budgets accetta category 'anthropic-robot'", async () => {
    const { data, error } = await admin
      .from("ai_spend_budgets")
      .upsert(
        {
          organization_id: ORG_ID,
          category: "anthropic-robot",
          monthly_cap_usd: 30,
          alert_threshold_percent: 80,
          is_active: true,
        },
        { onConflict: "organization_id,category" },
      )
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.category).toBe("anthropic-robot");
    expect(Number(data?.monthly_cap_usd)).toBe(30);

    // Cleanup
    if (data?.id) {
      await admin.from("ai_spend_budgets").delete().eq("id", data.id);
    }
  });

  it("ai_spend_ledger accetta category 'anthropic-robot'", async () => {
    const { data, error } = await admin
      .from("ai_spend_ledger")
      .insert({
        organization_id: ORG_ID,
        category: "anthropic-robot",
        action: "robot.chat.test",
        cost_usd: 0.0001,
        tokens_in: 100,
        tokens_out: 50,
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.category).toBe("anthropic-robot");

    // Cleanup
    if (data?.id) {
      await admin.from("ai_spend_ledger").delete().eq("id", data.id);
    }
  });
});
