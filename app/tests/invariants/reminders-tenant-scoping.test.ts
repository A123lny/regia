// RS-3 RN-87 · reminders tenant scoping.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getReminder, listReminders } from "@/modules/m09-reminders/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("reminders: tenant scoping IDOR", () => {
  let reminderIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — rem tenant" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — rem tenant" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-rt-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Brand: ${brandA.error?.message}`);

    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgAId,
        brand_id: (brandA.data as { id: string }).id,
        first_name: "T",
        email: "t@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`Contact: ${contact.error?.message}`);

    const r = await admin
      .from("reminders")
      .insert({
        organization_id: orgAId,
        brand_id: (brandA.data as { id: string }).id,
        contact_id: (contact.data as { id: string }).id,
        kind: "welcome",
        status: "pending",
      })
      .select("id")
      .single();
    if (r.error || !r.data) throw new Error(`Reminder: ${r.error?.message}`);
    reminderIdOrgA = (r.data as { id: string }).id;
  });

  it("getReminder(id, orgB) → null (IDOR bloccato)", async () => {
    const result = await getReminder(reminderIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getReminder(id, orgA) → reminder (legittimo)", async () => {
    const result = await getReminder(reminderIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(reminderIdOrgA);
  });

  it("listReminders(orgB) non include reminders di orgA", async () => {
    const list = await listReminders({ organizationId: orgBId });
    const found = list.find((r) => r.id === reminderIdOrgA);
    expect(found).toBeUndefined();
  });
});
