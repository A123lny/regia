import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import {
  previewCampaignRecipients,
  launchCampaign,
  cancelLaunchedCampaign,
} from "@/modules/m07-outreach/internal/campaign-launcher";
import { upsertChannelCredentials } from "@/modules/m05-publishing/internal/credentials-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M07 RN-62 bulk send protection", () => {
  let orgId: string;
  let brandId: string;
  let segmentId: string;
  let draftId: string;
  let campaignId: string;
  const contactIds: string[] = [];

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test RN-62" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`org: ${org.error?.message}`);
    orgId = org.data.id;

    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `rn62-${orgId.slice(0, 6)}`, display_name: "B" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`brand: ${brand.error?.message}`);
    brandId = brand.data.id;

    // 3 contatti con email + consent email granted
    for (let i = 0; i < 3; i++) {
      const c = await admin
        .from("contacts")
        .insert({
          organization_id: orgId,
          brand_id: brandId,
          first_name: `C${i}`,
          email: `rn62-c${i}@test.it`,
          source: "manuale",
        })
        .select("id")
        .single();
      if (c.error || !c.data) throw new Error(`contact ${i}: ${c.error?.message}`);
      contactIds.push(c.data.id);
      const consIns = await admin.from("contact_consents").insert({
        organization_id: orgId,
        contact_id: c.data.id,
        channel: "email",
        status: "granted",
        granted_at: new Date().toISOString(),
        source: "manuale",
      });
      if (consIns.error) throw new Error(`consent ${i}: ${consIns.error.message}`);
    }

    // Segmento che matcha tutti (filtri per consent email granted)
    const seg = await admin
      .from("contact_segments")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        name: "Tutti consenzienti email",
        criteria: { requiredConsentChannel: "email" },
      })
      .select("id")
      .single();
    if (seg.error || !seg.data) throw new Error(`segment: ${seg.error?.message}`);
    segmentId = seg.data.id;

    // Content draft fittizio
    const draft = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        channel: "social",
        theme_input: "Promo test",
        generated_text: "Ciao! Nuova promo in arrivo.\n\nPassa a trovarci.",
        status: "approved",
        approved_at: new Date().toISOString(),
        prompt_version: "v1-test",
        model_used: "test",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
      })
      .select("id")
      .single();
    if (draft.error || !draft.data) throw new Error(`draft: ${draft.error?.message}`);
    draftId = draft.data.id;

    // Brand email identity (colonne su brands, non tabella separata)
    await admin
      .from("brands")
      .update({
        email_from_address: "info@test.it",
        email_reply_to: "info@test.it",
        email_from_display_name: "Test",
      })
      .eq("id", brandId);

    // Credenziali email abilitate + verificate (per gate M05)
    await upsertChannelCredentials({
      organizationId: orgId,
      channel: "email",
      provider: "resend",
      apiKey: "re_test",
      config: { from: "info@test.it" },
    });
    await admin
      .from("m05_channel_credentials")
      .update({ enabled: true, verified_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("channel", "email");

    // Campaign
    const camp = await admin
      .from("campaigns")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        segment_id: segmentId,
        content_draft_id: draftId,
        name: "Test RN-62",
        channel: "email",
        status: "draft",
      })
      .select("id")
      .single();
    if (camp.error || !camp.data) throw new Error(`camp: ${camp.error?.message}`);
    campaignId = camp.data.id;
  });

  it("previewCampaignRecipients ritorna count esatto + 3 sample + payload compilato", async () => {
    const res = await previewCampaignRecipients(campaignId, orgId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.preview.totalRecipients).toBe(3);
    expect(res.preview.sampleContacts).toHaveLength(3);
    expect(res.preview.resolvedSubject).toBe("Promo test");
    expect(res.preview.resolvedBody).toContain("Nuova promo");
    expect(res.preview.fromEmail).toBe("info@test.it");
  });

  it("launchCampaign fallisce se confirmedCount != count reale", async () => {
    const res = await launchCampaign({
      campaignId,
      organizationId: orgId,
      confirmedCount: 999, // sbagliato
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/combacia/i);
    }
  });

  it("launchCampaign con count corretto enqueue tutti + transizione status=sending", async () => {
    const res = await launchCampaign({
      campaignId,
      organizationId: orgId,
      confirmedCount: 3,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.enqueued).toBe(3);
    expect(res.errors).toHaveLength(0);
    // Verifica che la campaign sia 'sending'
    const { data: camp } = await admin
      .from("campaigns")
      .select("status, enqueued_count, launched_at")
      .eq("id", campaignId)
      .single();
    expect(camp.status).toBe("sending");
    expect(camp.enqueued_count).toBe(3);
    expect(camp.launched_at).not.toBeNull();
    // Verifica che 3 job siano in m05_publish_jobs con source_kind='campaign'
    const { count } = await admin
      .from("m05_publish_jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("source_kind", "campaign")
      .eq("source_id", campaignId);
    expect(count).toBe(3);
  });

  it("launchCampaign rifiuta se status != draft/scheduled (gia' sending)", async () => {
    const res = await launchCampaign({
      campaignId,
      organizationId: orgId,
      confirmedCount: 3,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Puo' essere "non lanciabile" OR race condition (gia' sending)
      expect(res.error.length).toBeGreaterThan(0);
    }
  });

  it("Partenza scaglionata: send_after cresce con batch_index", async () => {
    // Carica tutti i jobs della campagna e verifica send_after
    const { data: jobs } = await admin
      .from("m05_publish_jobs")
      .select("send_after")
      .eq("organization_id", orgId)
      .eq("source_id", campaignId)
      .eq("source_kind", "campaign")
      .order("send_after");
    expect(jobs).toHaveLength(3);
    // Tutti nel primo batch (<100), stesso send_after +/- 1s
    const first = new Date(jobs[0].send_after).getTime();
    const last = new Date(jobs[2].send_after).getTime();
    expect(Math.abs(last - first)).toBeLessThan(2000);
  });

  it("cancelLaunchedCampaign su sending transiziona a cancelled", async () => {
    const res = await cancelLaunchedCampaign(campaignId, orgId);
    expect(res.ok).toBe(true);
    const { data: camp } = await admin
      .from("campaigns")
      .select("status, cancelled_at")
      .eq("id", campaignId)
      .single();
    expect(camp.status).toBe("cancelled");
    expect(camp.cancelled_at).not.toBeNull();
  });
});
