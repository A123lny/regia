// RS-3 RN-87: listScheduledByBrandBetween filtra su organization_id — IDOR impossibile.
// Coerente col pattern T11 e final review F1.5a.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { listScheduledByBrandBetween } from "@/modules/m03-editorial/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("listScheduledByBrandBetween: tenant scoping IDOR (RS-3, RN-87)", () => {
  let brandIdOrgA: string;
  let orgAId: string;
  let orgBId: string;
  const fromIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const toIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    // 2 organizzazioni isolate.
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — scheduled scoping" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A fallito: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — scheduled scoping" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B fallito: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-sched-${orgAId.slice(0, 8)}`,
        display_name: "Brand A Sched",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data)
      throw new Error(`Setup brand-A fallito: ${brandA.error?.message}`);
    brandIdOrgA = (brandA.data as { id: string }).id;

    // Draft scheduled per org-A (2 draft, in range).
    const approvedAt = new Date(Date.now() - 60 * 60 * 1000);
    const scheduledAt1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledAt2 = new Date(Date.now() + 48 * 60 * 60 * 1000);
    for (const [i, sa] of [scheduledAt1, scheduledAt2].entries()) {
      const d = await admin.from("content_drafts").insert({
        organization_id: orgAId,
        brand_id: brandIdOrgA,
        channel: "social",
        theme_input: `test sched org-a ${i}`,
        generated_text: `testo ${i}`,
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "scheduled",
        approved_at: approvedAt.toISOString(),
        scheduled_at: sa.toISOString(),
        created_by: null,
      });
      if (d.error) throw new Error(`Setup draft ${i} org-A fallito: ${d.error.message}`);
    }
  });

  it("listScheduledByBrandBetween(brandIdOrgA, orgBId, ...) → [] (IDOR bloccato)", async () => {
    const result = await listScheduledByBrandBetween(brandIdOrgA, orgBId, fromIso, toIso);
    expect(result).toEqual([]);
  });

  it("listScheduledByBrandBetween(brandIdOrgA, orgAId, ...) → 2 drafts (accesso legittimo)", async () => {
    const result = await listScheduledByBrandBetween(brandIdOrgA, orgAId, fromIso, toIso);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((d) => d.organizationId === orgAId)).toBe(true);
    expect(result.every((d) => d.status === "scheduled" || d.status === "published")).toBe(true);
  });
});
