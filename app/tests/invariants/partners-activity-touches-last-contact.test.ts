// Trigger `trg_activities_touch_last_contact`: insert su partner_activities
// aggiorna partner_restaurants.last_contact_at all'occurred_at, se piu recente.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RF-7.2 · trigger activity → last_contact_at", () => {
  let orgId: string;
  let brandId: string;
  let partnerId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — activity-trigger" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-act-${orgId.slice(0, 8)}`,
        display_name: "Brand act",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    const p = await admin
      .from("partner_restaurants")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "P1",
        onboarding_status: "attivo",
      })
      .select("id, last_contact_at")
      .single();
    if (p.error || !p.data) throw new Error(`Setup partner: ${p.error?.message}`);
    partnerId = (p.data as { id: string }).id;
    // Partner appena creato: last_contact_at deve essere null
    expect((p.data as { last_contact_at: string | null }).last_contact_at).toBeNull();
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  // Postgres timestamptz può ritornare con offset '+00:00' invece di 'Z' —
  // confronto normalizzato via Date.getTime() per essere robust al formato.
  async function readLastContactMs(): Promise<number | null> {
    const { data } = await admin
      .from("partner_restaurants")
      .select("last_contact_at")
      .eq("id", partnerId)
      .single();
    const iso = ((data as { last_contact_at: string | null }) ?? {}).last_contact_at ?? null;
    return iso ? new Date(iso).getTime() : null;
  }

  it("insert prima attività → last_contact_at aggiornato", async () => {
    const t = new Date("2026-01-01T10:00:00Z");
    await admin.from("partner_activities").insert({
      organization_id: orgId,
      partner_id: partnerId,
      kind: "chiamata",
      summary: "prima chiamata",
      occurred_at: t.toISOString(),
    });
    expect(await readLastContactMs()).toBe(t.getTime());
  });

  it("insert attività PIÙ VECCHIA → last_contact_at INVARIATO", async () => {
    const older = new Date("2025-12-01T10:00:00Z");
    await admin.from("partner_activities").insert({
      organization_id: orgId,
      partner_id: partnerId,
      kind: "email",
      summary: "email retroattiva",
      occurred_at: older.toISOString(),
    });
    // Deve rimanere quella più recente del test precedente
    expect(await readLastContactMs()).toBe(new Date("2026-01-01T10:00:00Z").getTime());
  });

  it("insert attività PIÙ RECENTE → last_contact_at aggiornato", async () => {
    const newer = new Date("2026-06-15T14:00:00Z");
    await admin.from("partner_activities").insert({
      organization_id: orgId,
      partner_id: partnerId,
      kind: "incontro",
      summary: "incontro recente",
      occurred_at: newer.toISOString(),
    });
    expect(await readLastContactMs()).toBe(newer.getTime());
  });
});
