import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sendMessage } from "@/modules/m05-publishing/public";
import { ConsentMissingError } from "@/modules/m05-publishing/public";
import { getAdminClient } from "@/lib/db/admin";
import { upsertChannelCredentials } from "@/modules/m05-publishing/internal/credentials-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M05 gateConsent (RF-1.4)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — gateConsent" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-consent-${orgId.slice(0, 8)}`,
        display_name: "Brand consent",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  it("throw ConsentMissingError se contatto ha consent revoked", async () => {
    // Setup credenziali per passare gateChannelEnabled
    await upsertChannelCredentials({
      organizationId: orgId, channel: "email", provider: "resend",
      apiKey: "re_test", config: { from: "sender@x.it" },
    });
    // Marca come verificata
    const { error: markErr } = await admin.from("m05_channel_credentials")
      .update({ verified_at: new Date().toISOString() })
      .eq("organization_id", orgId).eq("channel", "email");
    if (markErr) throw new Error(`Failed to mark verified: ${markErr.message}`);
    const { data: c, error: insertErr } = await admin.from("contacts").insert({
      organization_id: orgId, brand_id: brandId, first_name: "Test", email: "no-consent@x.it", source: "manuale",
    }).select("id").single();
    if (insertErr || !c) throw new Error(`Failed to insert contact: ${insertErr?.message}`);
    await admin.from("contact_consents").insert({
      organization_id: orgId, contact_id: c.id, channel: "email", status: "revoked",
    });
    await expect(sendMessage({
      organizationId: orgId, channel: "email", recipientContactId: c.id,
      payload: { channel: "email", to: "no-consent@x.it", subject: "s", html: "h", from: "sender@x.it" },
      sourceKind: "test", sourceId: null, isPromotional: false,
    })).rejects.toThrow(ConsentMissingError);
  });
});
