// M09 Â· UNIQUE parziale su (contact, kind, reference) per pending.
// scheduleReminder Ã¨ idempotente: chiamata 2 volte con stessi param non crea duplicati.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { listReminders } from "@/modules/m09-reminders/public";
import { scheduleWelcomeReminder } from "@/modules/m09-reminders/server";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("M09 Â· reminders idempotency + UNIQUE constraint", () => {
  let orgId: string;
  let brandId: string;
  let contactId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org â€” reminders idem" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-rem-${orgId.slice(0, 8)}`,
        display_name: "Brand rem",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "Rem",
        email: "rem@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`Contact: ${contact.error?.message}`);
    contactId = (contact.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("scheduleWelcomeReminder x1 â†’ 1 record pending", async () => {
    await scheduleWelcomeReminder({ organizationId: orgId, brandId, contactId });
    const list = await listReminders({
      organizationId: orgId,
      kind: "welcome",
      status: "pending",
    });
    expect(list.filter((r) => r.contactId === contactId).length).toBe(1);
  });

  it("scheduleWelcomeReminder x3 â†’ SEMPRE 1 record pending (idempotente)", async () => {
    await scheduleWelcomeReminder({ organizationId: orgId, brandId, contactId });
    await scheduleWelcomeReminder({ organizationId: orgId, brandId, contactId });
    await scheduleWelcomeReminder({ organizationId: orgId, brandId, contactId });
    const list = await listReminders({
      organizationId: orgId,
      kind: "welcome",
      status: "pending",
    });
    expect(list.filter((r) => r.contactId === contactId).length).toBe(1);
  });

  it("status invalido â†’ violazione check", async () => {
    const r = await admin.from("reminders").insert({
      organization_id: orgId,
      brand_id: brandId,
      contact_id: contactId,
      kind: "welcome",
      status: "wut",
    });
    expect(r.error).not.toBeNull();
  });

  it("kind invalido â†’ violazione check", async () => {
    const r = await admin.from("reminders").insert({
      organization_id: orgId,
      brand_id: brandId,
      contact_id: contactId,
      kind: "kind_inesistente",
      status: "pending",
    });
    expect(r.error).not.toBeNull();
  });

  it("status=sent senza sent_at â†’ violazione check", async () => {
    const r = await admin.from("reminders").insert({
      organization_id: orgId,
      brand_id: brandId,
      contact_id: contactId,
      kind: "thanks_order",
      status: "sent",
      sent_at: null,
    });
    expect(r.error).not.toBeNull();
  });

  it("status=dismissed senza dismissed_at â†’ violazione check", async () => {
    const r = await admin.from("reminders").insert({
      organization_id: orgId,
      brand_id: brandId,
      contact_id: contactId,
      kind: "review_request",
      status: "dismissed",
      dismissed_at: null,
    });
    expect(r.error).not.toBeNull();
  });
});
