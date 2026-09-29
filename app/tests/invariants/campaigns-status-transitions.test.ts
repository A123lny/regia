// Check constraint `campaigns_status_timestamps`:
//   draft → sent_at null
//   scheduled → planned_at not null, sent_at null
//   sent → sent_at not null
//   cancelled → free

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("campaigns · status/timestamps coerenza (RS-3)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — campaigns" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-camp-${orgId.slice(0, 8)}`,
        display_name: "Brand camp",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("draft senza sent_at → OK", async () => {
    const r = await admin
      .from("campaigns")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "T-draft",
        channel: "email",
        status: "draft",
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("scheduled senza planned_at → violazione check", async () => {
    const r = await admin.from("campaigns").insert({
      organization_id: orgId,
      brand_id: brandId,
      name: "T-sched-bad",
      channel: "email",
      status: "scheduled",
      planned_at: null,
    });
    expect(r.error).not.toBeNull();
  });

  it("scheduled con planned_at → OK", async () => {
    const r = await admin
      .from("campaigns")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "T-sched-ok",
        channel: "email",
        status: "scheduled",
        planned_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("sent senza sent_at → violazione check", async () => {
    const r = await admin.from("campaigns").insert({
      organization_id: orgId,
      brand_id: brandId,
      name: "T-sent-bad",
      channel: "email",
      status: "sent",
      sent_at: null,
    });
    expect(r.error).not.toBeNull();
  });

  it("sent con sent_at → OK", async () => {
    const r = await admin
      .from("campaigns")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "T-sent-ok",
        channel: "email",
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id");
    expect(r.error).toBeNull();
  });

  it("attempted_count negativo → violazione check", async () => {
    const r = await admin.from("campaigns").insert({
      organization_id: orgId,
      brand_id: brandId,
      name: "T-neg",
      channel: "email",
      status: "draft",
      attempted_count: -1,
    });
    expect(r.error).not.toBeNull();
  });
});
