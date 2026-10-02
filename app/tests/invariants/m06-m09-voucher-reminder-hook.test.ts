import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import { scheduleVoucherExpiringReminderOnIssue } from "@/modules/m09-reminders/public";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M06 → M09 voucher-expiring reminder hook", () => {
  let orgId: string;
  let brandId: string;
  let contactId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test M06→M09 hook" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`setup org: ${org.error?.message}`);
    orgId = org.data.id;
    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `h-${orgId.slice(0, 8)}`, display_name: "H" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`setup brand: ${brand.error?.message}`);
    brandId = brand.data.id;
    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "Luca",
        email: "luca-hook@test.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`setup contact: ${contact.error?.message}`);
    contactId = contact.data.id;
  });

  it("crea reminder voucher_expiring con scheduledAt = expires - 10gg", async () => {
    const voucherId = "11111111-aaaa-bbbb-cccc-111111111111";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const created = await scheduleVoucherExpiringReminderOnIssue({
      organizationId: orgId,
      brandId,
      contactId,
      voucherId,
      code: "TESTCODE1",
      expiresAtIso: expiresAt.toISOString(),
    });
    expect(created).toBe(true);
    const { data } = await admin
      .from("reminders")
      .select("id, kind, reference_type, reference_id, scheduled_at, message_hint")
      .eq("organization_id", orgId)
      .eq("kind", "voucher_expiring")
      .eq("reference_id", voucherId)
      .single();
    expect(data.kind).toBe("voucher_expiring");
    expect(data.reference_type).toBe("voucher");
    // scheduledAt deve essere ~20 giorni da oggi (expires - 10gg)
    const scheduled = new Date(data.scheduled_at).getTime();
    const expectedScheduled = expiresAt.getTime() - 10 * 24 * 60 * 60 * 1000;
    expect(Math.abs(scheduled - expectedScheduled)).toBeLessThan(60 * 1000);
    expect(data.message_hint).toContain("TESTCODE1");
  });

  it("se expires < 10gg, scheduledAt = adesso (non in passato)", async () => {
    const voucherId = "22222222-aaaa-bbbb-cccc-222222222222";
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // scade fra 3gg
    const before = Date.now();
    const created = await scheduleVoucherExpiringReminderOnIssue({
      organizationId: orgId,
      brandId,
      contactId,
      voucherId,
      code: "URGENT1",
      expiresAtIso: expiresAt.toISOString(),
    });
    expect(created).toBe(true);
    const { data } = await admin
      .from("reminders")
      .select("scheduled_at")
      .eq("organization_id", orgId)
      .eq("reference_id", voucherId)
      .single();
    const scheduled = new Date(data.scheduled_at).getTime();
    // scheduled >= before (deve essere "adesso", non expires - 10 che sarebbe passato)
    expect(scheduled).toBeGreaterThanOrEqual(before - 60 * 1000);
  });

  it("chiamare due volte per stesso voucherId e' idempotente (no duplicato)", async () => {
    const voucherId = "33333333-aaaa-bbbb-cccc-333333333333";
    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    await scheduleVoucherExpiringReminderOnIssue({
      organizationId: orgId,
      brandId,
      contactId,
      voucherId,
      code: "DUP1",
      expiresAtIso: expiresAt.toISOString(),
    });
    const second = await scheduleVoucherExpiringReminderOnIssue({
      organizationId: orgId,
      brandId,
      contactId,
      voucherId,
      code: "DUP1",
      expiresAtIso: expiresAt.toISOString(),
    });
    // Secondo tentativo deve ritornare false (reminder gia' esiste)
    expect(second).toBe(false);
    const { count } = await admin
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("reference_id", voucherId);
    expect(count).toBe(1);
  });
});
