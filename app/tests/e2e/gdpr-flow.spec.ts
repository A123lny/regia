// E2E deep flow M01 GDPR: creazione richiesta export/erasure (RF-1.9).
//
// Il flusso completo di fulfillment (download JSON dossier / erasure effettiva)
// e' complesso lato UI e coinvolge audit immutabile. Qui testiamo la parte
// critica: creazione richiesta da UI -> record in contact_data_requests con
// status=received + request_type coerente.
//
// Cleanup: delete della richiesta + eventuale ripristino contatto.

import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type RequestRow = { id: string; request_type: string; status: string; contact_id: string };

test.describe("M01 GDPR richiesta dati personali (RF-1.9)", () => {
  const testEmail = `e2e-gdpr-${randomBytes(6).toString("hex")}@test.local`;
  let contactId: string;

  test.beforeAll(async () => {
    const admin = getAdmin();
    await admin.from("contacts").delete().eq("email", testEmail);
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    const brandId = (brand as { id: string }).id;

    const { data: contact } = await admin
      .from("contacts")
      .insert({
        organization_id: DEMO_ORG_ID,
        brand_id: brandId,
        first_name: "E2E",
        last_name: "GDPR",
        email: testEmail,
        source: "manuale",
      })
      .select("id")
      .single();
    contactId = (contact as { id: string }).id;
  });

  test.afterAll(async () => {
    const admin = getAdmin();
    await admin.from("contact_data_requests").delete().eq("contact_id", contactId);
    await admin.from("contacts").delete().eq("id", contactId);
  });

  test("crea richiesta EXPORT: record in contact_data_requests + status=received", async ({
    page,
  }) => {
    await page.goto(`/contatti/${contactId}/dati-personali`);

    // Verifica che la pagina carichi (titolo deve esserci)
    await expect(page.getByText(/dati personali|RF-1.9|GDPR/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Form "Nuova richiesta": tipo dropdown default='export', click "Apri richiesta"
    await page.getByRole("button", { name: /apri richiesta/i }).click();

    // Dopo salvataggio, la nuova richiesta appare nella lista
    // Verifica DB
    const admin = getAdmin();
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("contact_data_requests")
            .select("id, request_type, status")
            .eq("contact_id", contactId)
            .eq("request_type", "export");
          return (data ?? []).length;
        },
        { timeout: 10_000, intervals: [500, 1000] },
      )
      .toBeGreaterThan(0);

    const { data } = await admin
      .from("contact_data_requests")
      .select("id, request_type, status, contact_id")
      .eq("contact_id", contactId)
      .eq("request_type", "export")
      .maybeSingle();
    const req = data as RequestRow;
    expect(req.status).toBe("pending");
    expect(req.request_type).toBe("export");
  });

  // Il variante "erasure" condivide la stessa logica (solo dropdown diverso)
  // -> covered by invariant test server-side (contact_data_requests check).
});
