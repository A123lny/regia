// RF-8.8 M09 → M08 bridge: dopo resolve segnale abbandono, se Owner indica
// askForReview, viene schedulato un reminder review_request idempotente.
//
// Testa il contratto: scheduleReminder(kind='review_request', reference_type=
// 'abandonment_signal', reference_id=signalId) inserisce 1 riga; chiamata
// idempotente non duplica.

import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { scheduleReminder } from "@/modules/m09-reminders/internal/reminders-repo";
import { resolveAbandonmentSignal } from "@/modules/m09-reminders/internal/abandonment-repo";

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
    .is("is_duplicate_of", null)
    .limit(1)
    .maybeSingle();
  if (data) return { id: (data as { id: string }).id, created: false };
  // CI parte da DB vergine (supabase db reset): nessun contact. Crea un test contact.
  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      organization_id: ORG_ID,
      brand_id: brandId,
      first_name: "RF88",
      last_name: "Test",
      email: `rf88-test-${Date.now()}@test.local`,
      source: "manuale",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Insert test contact: ${error?.message}`);
  return { id: (created as { id: string }).id, created: true };
}

describe("RF-8.8 · M09→M08 review_request on abandonment resolve", () => {
  const createdSignalIds: string[] = [];
  const createdReminderIds: string[] = [];
  let brandId: string;
  let contactId: string;
  let contactWasCreated = false;

  beforeAll(async () => {
    brandId = await getLennyBrandId();
    const c = await getOrCreateContactId(brandId);
    contactId = c.id;
    contactWasCreated = c.created;
  });

  afterAll(async () => {
    for (const rid of createdReminderIds) {
      await admin.from("reminders").delete().eq("id", rid);
    }
    for (const sid of createdSignalIds) {
      await admin.from("abandonment_signals").delete().eq("id", sid);
    }
    // Pulizia test contact creato ad-hoc (solo se abbiamo creato noi, non toccare seed)
    if (contactWasCreated && contactId) {
      await admin.from("contacts").delete().eq("id", contactId);
    }
  });

  async function createSignal(): Promise<string> {
    // Cleanup eventuale duplicato stesso contact+kind (UNIQUE partial)
    await admin
      .from("abandonment_signals")
      .delete()
      .eq("contact_id", contactId)
      .eq("kind", "silence_gap")
      .is("resolved_at", null);
    const windowEnd = new Date();
    const windowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const { data } = await admin
      .from("abandonment_signals")
      .insert({
        organization_id: ORG_ID,
        brand_id: brandId,
        contact_id: contactId,
        kind: "silence_gap",
        severity: "medium",
        signal_at: new Date().toISOString(),
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        previous_orders_count: 5,
        current_orders_count: 0,
        notes: "[RF-8.8 test]",
      })
      .select("id")
      .single();
    const id = (data as { id: string }).id;
    createdSignalIds.push(id);
    return id;
  }

  it("resolve + askForReview → crea reminder review_request pending", async () => {
    const signalId = await createSignal();

    const resolved = await resolveAbandonmentSignal(signalId, ORG_ID, "Cliente recuperato");
    expect(resolved).not.toBeNull();
    expect(resolved!.resolvedAt).not.toBeNull();
    expect(resolved!.contactId).toBe(contactId);
    expect(resolved!.brandId).toBe(brandId);

    const result = await scheduleReminder({
      organizationId: ORG_ID,
      brandId: resolved!.brandId,
      contactId: resolved!.contactId,
      kind: "review_request",
      referenceType: "abandonment_signal",
      referenceId: signalId,
    });
    expect(result.created).toBe(true);
    expect(result.reminderId).not.toBeNull();
    createdReminderIds.push(result.reminderId!);

    const { data: reminder } = await admin
      .from("reminders")
      .select("kind, status, reference_type, reference_id, contact_id, brand_id")
      .eq("id", result.reminderId!)
      .maybeSingle();
    expect((reminder as { kind: string }).kind).toBe("review_request");
    expect((reminder as { status: string }).status).toBe("pending");
    expect((reminder as { reference_type: string }).reference_type).toBe("abandonment_signal");
    expect((reminder as { reference_id: string }).reference_id).toBe(signalId);
    expect((reminder as { contact_id: string }).contact_id).toBe(contactId);
    expect((reminder as { brand_id: string }).brand_id).toBe(brandId);
  });

  it("doppio schedule stesso signal → idempotente (0 duplicati)", async () => {
    const signalId = await createSignal();
    await resolveAbandonmentSignal(signalId, ORG_ID, "Secondo caso recuperato");

    const first = await scheduleReminder({
      organizationId: ORG_ID,
      brandId,
      contactId,
      kind: "review_request",
      referenceType: "abandonment_signal",
      referenceId: signalId,
    });
    createdReminderIds.push(first.reminderId!);

    const second = await scheduleReminder({
      organizationId: ORG_ID,
      brandId,
      contactId,
      kind: "review_request",
      referenceType: "abandonment_signal",
      referenceId: signalId,
    });
    // Idempotente: created=false, stesso reminderId
    expect(second.created).toBe(false);
    expect(second.reminderId).toBe(first.reminderId);

    // Verifica DB: una sola riga per quel reference_id
    const { data: all } = await admin
      .from("reminders")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("kind", "review_request")
      .eq("reference_id", signalId);
    expect((all ?? []).length).toBe(1);
  });
});
