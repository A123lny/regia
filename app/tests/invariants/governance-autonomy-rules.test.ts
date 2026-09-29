// M13 · autonomy_rules: check constraint level + tenant scoping + seed idempotente.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { listAutonomyRules, getAutonomyRuleByKind } from "@/modules/m13-governance/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("M13 · autonomy_rules invariants", () => {
  let orgId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — autonomy" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("level invalido → violazione check constraint", async () => {
    const r = await admin.from("autonomy_rules").insert({
      organization_id: orgId,
      kind: "test-invalid",
      title: "Test",
      description: "Test invalid level",
      level: "wut",
    });
    expect(r.error).not.toBeNull();
  });

  it("level valido 'never' → OK", async () => {
    const r = await admin
      .from("autonomy_rules")
      .insert({
        organization_id: orgId,
        kind: "test-never",
        title: "Test",
        description: "Test",
        level: "never",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("UNIQUE (org, kind) → duplicato bloccato", async () => {
    const r = await admin.from("autonomy_rules").insert({
      organization_id: orgId,
      kind: "test-never",
      title: "Duplicato",
      description: "Duplicato",
      level: "auto",
    });
    expect(r.error).not.toBeNull();
    expect(r.error?.message.toLowerCase()).toMatch(/duplicate|unique/);
  });

  it("title vuoto → violazione check", async () => {
    const r = await admin.from("autonomy_rules").insert({
      organization_id: orgId,
      kind: "test-empty-title",
      title: "   ",
      description: "Test",
      level: "auto",
    });
    expect(r.error).not.toBeNull();
  });

  it("tenant scoping: listAutonomyRules(orgB) non vede regole di orgA", async () => {
    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — autonomy" })
      .select("id")
      .single();
    const orgBId = (orgB.data as { id: string }).id;

    const listA = await listAutonomyRules(orgId);
    const listB = await listAutonomyRules(orgBId);

    // orgId ha almeno la regola 'test-never' che abbiamo creato
    expect(listA.some((r) => r.kind === "test-never")).toBe(true);
    // orgBId non deve vederla
    expect(listB.some((r) => r.kind === "test-never")).toBe(false);

    // cleanup
    await admin.from("organizations").delete().eq("id", orgBId);
  });

  it("getAutonomyRuleByKind ritorna null se non esiste per l'org", async () => {
    const r = await getAutonomyRuleByKind(orgId, "kind-che-non-esiste");
    expect(r).toBeNull();
  });
});
