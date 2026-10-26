// E2E deep flow M01: revoca consenso canale -> DB updated.
//
// Pattern: creiamo contatto + consenso granted email via DB. Apriamo il drawer
// del contatto in /contatti, cambiamo il select del canale da "Attivo" a
// "Disiscritto". Verifichiamo DB: contact_consents.status='revoked' con
// timestamp aggiornato.
//
// Il "gate M05/M09" dipendente da questa revoca e' coperto dai test invarianti
// (publish-blocked-when-no-consent). Qui testiamo solo il flow UI -> DB.

import { test, expect } from "@playwright/test";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type ConsentRow = { status: string; revoked_at: string | null };

test.describe("M01 revoca consenso canale -> DB updated", () => {
  const testEmail = `e2e-consent-${Date.now()}@test.local`;
  let contactId: string;
  let brandId: string;

  test.beforeAll(async () => {
    const admin = getAdmin();
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    brandId = (brand as { id: string }).id;
  });

  test.beforeEach(async () => {
    const admin = getAdmin();
    // Pulizia residui test precedenti
    await admin.from("contacts").delete().eq("email", testEmail);

    // Contatto test
    const { data: contact, error } = await admin
      .from("contacts")
      .select("id")
      .eq("email", testEmail)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (contact) {
      contactId = (contact as { id: string }).id;
    } else {
      const { data: newContact } = await admin
        .from("contacts")
        .insert({
          organization_id: DEMO_ORG_ID,
          brand_id: brandId,
          first_name: "E2E",
          last_name: "Consent",
          email: testEmail,
          source: "manuale",
        })
        .select("id")
        .single();
      contactId = (newContact as { id: string }).id;
    }

    // Consenso email granted
    await admin.from("contact_consents").upsert(
      {
        organization_id: DEMO_ORG_ID,
        contact_id: contactId,
        channel: "email",
        status: "granted",
        granted_at: new Date().toISOString(),
        source: "manuale",
        evidence_text: "E2E setup",
      },
      { onConflict: "contact_id,channel" },
    );
  });

  test.afterAll(async () => {
    const admin = getAdmin();
    await admin.from("contacts").delete().eq("email", testEmail);
  });

  test("revoca consenso email: granted -> revoked + revoked_at set", async ({ page }) => {
    // 1. Lista contatti -> cerco il mio
    await page.goto("/contatti");

    // 2. Click sulla riga con l'email di test (apre drawer)
    const row = page.locator("table tbody tr").filter({ hasText: testEmail });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    // 3. Drawer aperto -> sezione Consensi
    await expect(page.getByRole("heading", { name: /consensi per canale/i })).toBeVisible();

    // 4. Trova il select del canale Email DENTRO il drawer dialog (evita
    //    collisione coi select dei filtri lista contatti).
    //    Il drawer e' un [role="dialog"] di Radix Sheet.
    const dialog = page.getByRole("dialog");
    // Il select del canale email e' il primo <select> con option "Attivo"
    // (ordine: email, sms, whatsapp secondo CONSENT_CHANNEL_LABELS)
    const emailSelect = dialog
      .locator("select")
      .filter({ has: page.locator('option[value="granted"]') })
      .first();
    await emailSelect.selectOption("revoked");

    // 5. Dopo la server action, lo state locale cambia a revoked -> chip "Disiscritto"
    //    e nel DB il record viene aggiornato.
    //    Aspetto un attimo che la transition termini
    await page.waitForTimeout(1500);

    // 6. Verifica DB: consent status=revoked
    const admin = getAdmin();
    const { data } = await admin
      .from("contact_consents")
      .select("status, revoked_at")
      .eq("contact_id", contactId)
      .eq("channel", "email")
      .maybeSingle();
    const row2 = data as ConsentRow | null;
    expect(row2?.status).toBe("revoked");
    expect(row2?.revoked_at).not.toBeNull();
  });
});
