import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import {
  revokeConsentFromToken,
  applyUnsubscribe,
  resolveUnsubscribeToken,
  getUnsubscribePressureAlerts,
} from "@/modules/m05-publishing/public";
import { createUnsubscribeToken } from "@/modules/m05-publishing/internal/unsubscribe-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M05 Unsubscribe flow (RN-64..67)", () => {
  let orgId: string;
  let brandId: string;
  let contactId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test unsub" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`org: ${org.error?.message}`);
    orgId = org.data.id;
    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `u-${orgId.slice(0, 6)}`, display_name: "U" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`brand: ${brand.error?.message}`);
    brandId = brand.data.id;
    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "Unsub",
        email: "unsub@test.it",
        phone: "+393330000001",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`contact: ${contact.error?.message}`);
    contactId = contact.data.id;
    // Consensi email + whatsapp + sms granted (per testare propagazione)
    for (const ch of ["email", "whatsapp", "sms"] as const) {
      const r = await admin.from("contact_consents").insert({
        organization_id: orgId,
        contact_id: contactId,
        channel: ch,
        status: "granted",
        granted_at: new Date().toISOString(),
        source: "manuale",
      });
      if (r.error) throw new Error(`consent ${ch}: ${r.error.message}`);
    }
  });

  it("RN-64 vincolo assoluto: revokeConsentFromToken revoca il consent del canale IMMEDIATAMENTE", async () => {
    const token = await createUnsubscribeToken({
      organizationId: orgId,
      contactId,
      channel: "email",
    });
    const res = await revokeConsentFromToken(token, "1.2.3.4");
    expect(res.ok).toBe(true);
    const { data } = await admin
      .from("contact_consents")
      .select("status, revoked_at")
      .eq("contact_id", contactId)
      .eq("channel", "email")
      .single();
    expect(data.status).toBe("revoked");
    expect(data.revoked_at).not.toBeNull();
    // Token marcato used
    const resolved = await resolveUnsubscribeToken(token);
    expect(resolved?.usedAt).not.toBeNull();
  });

  it("Token invalido ritorna null su resolve e { ok: false } su revoke", async () => {
    const fakeToken = "00000000-0000-0000-0000-000000000000";
    expect(await resolveUnsubscribeToken(fakeToken)).toBeNull();
    const r = await revokeConsentFromToken(fakeToken);
    expect(r.ok).toBe(false);
  });

  it("RN-65/66 applyUnsubscribe salva motivo + reduce_frequency + propagazione alsoChannels", async () => {
    // Nuovo contatto per test pulito
    const c2 = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "C2",
        email: "unsub2@test.it",
        source: "manuale",
      })
      .select("id")
      .single();
    const contact2Id = c2.data.id;
    for (const ch of ["email", "whatsapp"] as const) {
      await admin.from("contact_consents").insert({
        organization_id: orgId,
        contact_id: contact2Id,
        channel: ch,
        status: "granted",
        granted_at: new Date().toISOString(),
        source: "manuale",
      });
    }
    const token = await createUnsubscribeToken({
      organizationId: orgId,
      contactId: contact2Id,
      channel: "email",
    });
    const res = await applyUnsubscribe({
      token,
      reason: "too_many_messages",
      reasonFree: null,
      reduceFrequency: false,
      alsoChannels: ["whatsapp"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.channelsRevoked).toContain("email");
    expect(res.channelsRevoked).toContain("whatsapp");
    const { data } = await admin
      .from("contact_consents")
      .select("channel, status, unsubscribe_reason")
      .eq("contact_id", contact2Id);
    for (const row of data as Array<{
      channel: string;
      status: string;
      unsubscribe_reason: string;
    }>) {
      expect(row.status).toBe("revoked");
      expect(row.unsubscribe_reason).toBe("too_many_messages");
    }
  });

  it("RN-66 reduceFrequency=true segna reduce_frequency invece di revocare", async () => {
    const c3 = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "C3",
        email: "unsub3@test.it",
        source: "manuale",
      })
      .select("id")
      .single();
    const contact3Id = c3.data.id;
    await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contact3Id,
      channel: "email",
      status: "granted",
      granted_at: new Date().toISOString(),
      source: "manuale",
    });
    const token = await createUnsubscribeToken({
      organizationId: orgId,
      contactId: contact3Id,
      channel: "email",
    });
    const res = await applyUnsubscribe({
      token,
      reason: "too_many_messages",
      reduceFrequency: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.channelsReduced).toContain("email");
    expect(res.channelsRevoked).toHaveLength(0);
    const { data } = await admin
      .from("contact_consents")
      .select("status, reduce_frequency, unsubscribe_reason")
      .eq("contact_id", contact3Id)
      .eq("channel", "email")
      .single();
    expect(data.status).toBe("granted"); // non revocato
    expect(data.reduce_frequency).toBe(true);
    expect(data.unsubscribe_reason).toBe("too_many_messages");
  });

  it("RN-67 getUnsubscribePressureAlerts: isAlert=true quando >=50% motivi 'too_many_messages' e >=3 revoche", async () => {
    // Setup org dedicato per isolare la query
    const orgAlert = await admin
      .from("organizations")
      .insert({ name: "Test alert" })
      .select("id")
      .single();
    const orgAId = orgAlert.data.id;
    const bAlert = await admin
      .from("brands")
      .insert({ organization_id: orgAId, slug: `a-${orgAId.slice(0, 6)}`, display_name: "A" })
      .select("id")
      .single();
    const bAId = bAlert.data.id;
    // 4 contatti con revoca email: 3 per "too_many", 1 "other" → ratio 75%
    for (let i = 0; i < 4; i++) {
      const c = await admin
        .from("contacts")
        .insert({
          organization_id: orgAId,
          brand_id: bAId,
          first_name: `P${i}`,
          email: `pres${i}@a.it`,
          source: "manuale",
        })
        .select("id")
        .single();
      await admin.from("contact_consents").insert({
        organization_id: orgAId,
        contact_id: c.data.id,
        channel: "email",
        status: "revoked",
        granted_at: new Date().toISOString(),
        revoked_at: new Date().toISOString(),
        unsubscribe_reason: i < 3 ? "too_many_messages" : "other",
        source: "manuale",
      });
    }
    const alerts = await getUnsubscribePressureAlerts(orgAId);
    const emailAlert = alerts.find((a) => a.channel === "email");
    expect(emailAlert).toBeDefined();
    expect(emailAlert?.revocations30d).toBe(4);
    expect(emailAlert?.tooMany30d).toBe(3);
    expect(emailAlert?.tooManyRatio).toBeCloseTo(0.75);
    expect(emailAlert?.isAlert).toBe(true);
  });
});
