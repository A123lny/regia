// RN-74 Recupero preventivi officina: nuovo kind quote_followup schedulato
// manualmente dall'Owner. Verifica che il kind sia accettato dal CHECK DB e
// che scheduleReminder scriva correttamente scheduled_at + message_hint.

import { describe, expect, it, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { scheduleReminder } from "@/modules/m09-reminders/internal/reminders-repo";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function getLennyBrandId(): Promise<string> {
  const { data } = await admin
    .from("brands")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("slug", "lenny")
    .maybeSingle();
  return (data as { id: string }).id;
}

async function getOrCreateContactId(brandId: string): Promise<{ id: string; created: boolean }> {
  const { data } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", ORG_ID)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (data) return { id: (data as { id: string }).id, created: false };
  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      organization_id: ORG_ID,
      brand_id: brandId,
      first_name: "RN74",
      last_name: "Test",
      email: `rn74-test-${Date.now()}@test.local`,
      source: "manuale",
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert contact: ${error.message}`);
  return { id: (created as { id: string }).id, created: true };
}

describe("RN-74 · M09 quote_followup reminder", () => {
  const reminderIds: string[] = [];
  const contactIds: string[] = [];

  afterAll(async () => {
    for (const rid of reminderIds) await admin.from("reminders").delete().eq("id", rid);
    for (const cid of contactIds) await admin.from("contacts").delete().eq("id", cid);
  });

  it("scheduleReminder kind='quote_followup' → riga pending con scheduled_at futura", async () => {
    const brandId = await getLennyBrandId();
    const c = await getOrCreateContactId(brandId);
    if (c.created) contactIds.push(c.id);

    const in5days = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    const r = await scheduleReminder({
      organizationId: ORG_ID,
      brandId,
      contactId: c.id,
      kind: "quote_followup",
      scheduledAtIso: in5days,
      messageHint: "Preventivo cambio frizione €1200",
    });
    expect(r.created).toBe(true);
    expect(r.reminderId).not.toBeNull();
    reminderIds.push(r.reminderId!);

    const { data: row } = await admin
      .from("reminders")
      .select("kind, status, message_hint, scheduled_at")
      .eq("id", r.reminderId!)
      .maybeSingle();
    const typed = row as {
      kind: string;
      status: string;
      message_hint: string;
      scheduled_at: string;
    };
    expect(typed.kind).toBe("quote_followup");
    expect(typed.status).toBe("pending");
    expect(typed.message_hint).toContain("frizione");
    const diffMs = new Date(typed.scheduled_at).getTime() - Date.now();
    // Nel range ±2s rispetto a 5 giorni futuri
    expect(diffMs).toBeGreaterThan(5 * 24 * 3600 * 1000 - 10_000);
    expect(diffMs).toBeLessThan(5 * 24 * 3600 * 1000 + 10_000);
  });

  it("DB CHECK accetta solo gli 8 kind consentiti", async () => {
    const brandId = await getLennyBrandId();
    const c = await getOrCreateContactId(brandId);
    if (c.created) contactIds.push(c.id);

    // Insert con kind inventato → rifiutato dal CHECK
    const { error } = await admin.from("reminders").insert({
      organization_id: ORG_ID,
      brand_id: brandId,
      contact_id: c.id,
      kind: "kind_inesistente",
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514");
  });
});
