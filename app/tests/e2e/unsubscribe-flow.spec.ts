// E2E deep flow M05 unsubscribe: landing /u/[token] -> revoca consenso
// pre-render (RN-64 vincolo tecnico assoluto).
//
// Flow pubblico senza auth: creiamo un contatto con consenso email granted,
// generiamo un token di unsubscribe, apriamo la pagina /u/<token> in
// context anonimo, verifichiamo che la revoca sia AVVENUTA PRIMA del
// render (RN-64: "il clic vale gia' come uscita, il resto e' una domanda
// in piu'").
//
// Cleanup: delete contatto + token.

import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type ConsentRow = { status: string; revoked_at: string | null };

test.describe("M05 unsubscribe landing /u/[token] (RN-64 revoca pre-render)", () => {
  const testEmail = `e2e-unsub-${randomBytes(6).toString("hex")}@test.local`;
  let contactId: string;
  let token: string;

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

    // Contatto test
    const { data: contact } = await admin
      .from("contacts")
      .insert({
        organization_id: DEMO_ORG_ID,
        brand_id: brandId,
        first_name: "E2E",
        last_name: "Unsub",
        email: testEmail,
        source: "manuale",
      })
      .select("id")
      .single();
    contactId = (contact as { id: string }).id;

    // Consenso email granted
    await admin.from("contact_consents").insert({
      organization_id: DEMO_ORG_ID,
      contact_id: contactId,
      channel: "email",
      status: "granted",
      granted_at: new Date().toISOString(),
      source: "manuale",
      evidence_text: "E2E unsubscribe test setup",
    });

    // Genera token unsubscribe
    const { data: tok } = await admin
      .from("m05_unsubscribe_tokens")
      .insert({
        organization_id: DEMO_ORG_ID,
        contact_id: contactId,
        channel: "email",
      })
      .select("token")
      .single();
    token = (tok as { token: string }).token;
  });

  test.afterAll(async () => {
    const admin = getAdmin();
    // CASCADE: cancellando contatto spariscono consensi + token
    await admin.from("contacts").delete().eq("id", contactId);
  });

  test("GET /u/<token> -> consenso email revoked PRIMA del render (RN-64)", async ({ browser }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    // Vai alla landing (context anonimo, no auth)
    await anonPage.goto(`http://localhost:3000/u/${token}`);

    // Verifica che compaia il messaggio di avvenuta disiscrizione
    // (il page.tsx revoca prima e poi mostra form con motivo opzionale)
    await expect(anonPage.getByText(/disiscritt|rimoss|disiscrizione/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await anonContext.close();

    // Verifica DB: consenso email -> revoked immediatamente
    const admin = getAdmin();
    const { data } = await admin
      .from("contact_consents")
      .select("status, revoked_at")
      .eq("contact_id", contactId)
      .eq("channel", "email")
      .maybeSingle();
    const row = data as ConsentRow;
    expect(row.status).toBe("revoked");
    expect(row.revoked_at).not.toBeNull();

    // Il token deve essere marcato used
    const { data: tokRow } = await admin
      .from("m05_unsubscribe_tokens")
      .select("used_at")
      .eq("token", token)
      .maybeSingle();
    expect((tokRow as { used_at: string | null }).used_at).not.toBeNull();
  });

  test("GET /u/<token-invalido> -> messaggio 'link non valido' (no crash)", async ({ browser }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    // Token UUID che non esiste
    const fakeToken = "00000000-0000-0000-0000-000000000000";
    await anonPage.goto(`http://localhost:3000/u/${fakeToken}`);

    await expect(anonPage.getByText(/link non valido|non valido|consumato/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await anonContext.close();
  });
});
