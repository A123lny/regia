// E2E deep flow M07 outreach: campagna launcher RN-62 (3 strati).
//
// Pattern: creiamo una campagna draft via DB admin (email, segmento Lenny
// esistente dal seed), clicchiamo il bottone "Lancia campagna" sulla riga,
// verifichiamo che:
// - STEP 1: "Carica anteprima" risolva segmento + mostri totalRecipients +
//   sampleContacts (3 destinatari)
// - STEP 2 e STEP 3: visibili dopo preview (ma NON cliccati — richiedono
//   M05 canali reali per invio di prova e partenza; la logica di lancio e'
//   coperta dai test invarianti server-side).
//
// Cleanup: delete della campagna test.

import { test, expect } from "@playwright/test";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type CampaignRow = { id: string; status: string };

test.describe("M07 outreach campaign launcher RN-62 (preview + strati 2-3 visibili)", () => {
  let campaignId: string;
  let brandId: string;
  let segmentId: string;

  let draftId: string;

  test.beforeAll(async () => {
    const admin = getAdmin();
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    brandId = (brand as { id: string }).id;

    // Usa un segmento Lenny esistente dal seed (es. "Attivi 30gg")
    const { data: segment } = await admin
      .from("contact_segments")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!segment) throw new Error("Nessun segmento Lenny attivo trovato (seed richiesto)");
    segmentId = (segment as { id: string }).id;

    // Usa un draft published del brand Lenny (preview richiede subject/body)
    const { data: draft } = await admin
      .from("content_drafts")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("brand_id", brandId)
      .eq("status", "published")
      .limit(1)
      .maybeSingle();
    if (!draft) throw new Error("Nessun draft Lenny published trovato (seed richiesto)");
    draftId = (draft as { id: string }).id;
  });

  test.beforeEach(async () => {
    const admin = getAdmin();
    const name = `[E2E ${Date.now()}] Test launcher`;
    const { data, error } = await admin
      .from("campaigns")
      .insert({
        organization_id: DEMO_ORG_ID,
        brand_id: brandId,
        segment_id: segmentId,
        content_draft_id: draftId,
        name,
        channel: "email",
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Insert campaign: ${error?.message}`);
    campaignId = (data as { id: string }).id;
  });

  test.afterEach(async () => {
    const admin = getAdmin();
    if (campaignId) await admin.from("campaigns").delete().eq("id", campaignId);
  });

  test("launcher: STEP 1 preview risolve destinatari + mostra sample 3 contatti", async ({
    page,
  }) => {
    await page.goto("/campagne");

    // Trova la riga della campagna di test (match sul name)
    const row = page.locator("table tbody tr").filter({ hasText: "[E2E" }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click bottone "Lancia campagna" (icona Rocket) via aria-label
    await row.getByRole("button", { name: /lancia campagna via m05/i }).click();

    // Dialog aperto: STEP 1 "Carica anteprima"
    await expect(page.getByRole("heading", { name: /lancia campagna via m05/i })).toBeVisible();
    await expect(page.getByText(/1 .+ anteprima destinatari/i)).toBeVisible();

    // Click "Carica anteprima"
    await page.getByRole("button", { name: /carica anteprima/i }).click();

    // Dopo caricamento: appare "Destinatari totali" + "Esempi"
    await expect(page.getByText(/destinatari totali/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/esempi.+3 destinatari/i)).toBeVisible();

    // STEP 2 e 3 ora visibili (abilitati solo dopo preview)
    await expect(page.getByText(/2 .+ invio di prova/i)).toBeVisible();
    await expect(page.getByText(/3 .+ partenza/i)).toBeVisible();

    // Verifichiamo che l'input per test email sia presente in STEP 2
    // (ma NON clicchiamo "Invia prova": richiede Resend configurato)
    await expect(page.getByPlaceholder(/tua@email/i)).toBeVisible();

    // DB: campaign status rimane 'draft' finche' non clicchiamo "Lancia"
    const admin = getAdmin();
    const { data } = await admin
      .from("campaigns")
      .select("status")
      .eq("id", campaignId)
      .maybeSingle();
    expect((data as CampaignRow).status).toBe("draft");
  });
});
