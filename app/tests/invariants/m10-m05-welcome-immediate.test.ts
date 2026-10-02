import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import { scheduleWelcomeReminder } from "@/modules/m09-reminders/public";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M10 → M05 welcome immediato (RN-63)", () => {
  let orgId: string;
  let brandId: string;
  let contactA: string;
  let contactB: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test RN-63" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`setup org: ${org.error?.message}`);
    orgId = org.data.id;
    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `w-${orgId.slice(0, 8)}`, display_name: "W" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`setup brand: ${brand.error?.message}`);
    brandId = brand.data.id;
    const ca = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "A",
        email: "wa@test.it",
        source: "qr",
      })
      .select("id")
      .single();
    if (ca.error || !ca.data) throw new Error(`contact A: ${ca.error?.message}`);
    contactA = ca.data.id;
    const cb = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "B",
        email: "wb@test.it",
        source: "qr",
      })
      .select("id")
      .single();
    if (cb.error || !cb.data) throw new Error(`contact B: ${cb.error?.message}`);
    contactB = cb.data.id;
  });

  it("scheduleWelcomeReminder ritorna reminderId e messageHint custom", async () => {
    const res = await scheduleWelcomeReminder({
      organizationId: orgId,
      brandId,
      contactId: contactA,
      scheduledAtIso: new Date().toISOString(),
      messageHint: "Benvenuto! Il tuo codice: ABC123",
    });
    expect(res.created).toBe(true);
    expect(res.reminderId).toBeTruthy();
    const { data: rem } = await admin
      .from("reminders")
      .select("message_hint, scheduled_at, status, kind")
      .eq("id", res.reminderId)
      .single();
    expect(rem.kind).toBe("welcome");
    expect(rem.status).toBe("pending");
    expect(rem.message_hint).toContain("ABC123");
    // scheduledAt ~ now (non +1h come era prima)
    const scheduled = new Date(rem.scheduled_at).getTime();
    const diffMs = Math.abs(scheduled - Date.now());
    expect(diffMs).toBeLessThan(60 * 1000); // entro 1 minuto da adesso
  });

  it("Default scheduledAt=now (RN-63 benvenuto immediato)", async () => {
    const before = Date.now();
    const res = await scheduleWelcomeReminder({
      organizationId: orgId,
      brandId,
      contactId: contactB,
    });
    expect(res.created).toBe(true);
    const { data: rem } = await admin
      .from("reminders")
      .select("scheduled_at")
      .eq("id", res.reminderId)
      .single();
    const scheduled = new Date(rem.scheduled_at).getTime();
    // Il nuovo default e' now (prima era now+1h)
    expect(scheduled).toBeGreaterThanOrEqual(before - 1000);
    expect(scheduled).toBeLessThan(before + 2 * 60 * 1000); // tolleranza 2min
  });

  it("Idempotente: 2 chiamate sullo stesso contatto creano 1 reminder, 2a ritorna reminderId esistente", async () => {
    const r1 = await scheduleWelcomeReminder({
      organizationId: orgId,
      brandId,
      contactId: contactA,
    });
    const r2 = await scheduleWelcomeReminder({
      organizationId: orgId,
      brandId,
      contactId: contactA,
    });
    // Il primo era creato nel test 1 → r1.created=false ora
    expect(r2.created).toBe(false);
    expect(r2.reminderId).toBeTruthy(); // ma ritorna l'id del pending esistente
    expect(r1.reminderId).toBe(r2.reminderId);
  });
});
