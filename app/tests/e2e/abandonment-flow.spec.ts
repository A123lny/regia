// E2E deep flow M09: resolve segnale abbandono -> DB updated + audit event.
//
// Pattern: creiamo un signal attivo via DB admin, apriamo il modal "Risolvi"
// (abandonment-client), compiliamo motivo + salviamo, verifichiamo:
// - DB: resolved_at + resolved_reason popolati
// - audit_events: nuova riga action='abandonment.resolved'
//
// Cleanup: delete signal + audit event test.

import { test, expect } from "@playwright/test";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type SignalRow = {
  id: string;
  resolved_at: string | null;
  resolved_reason: string | null;
};

type AuditRow = { id: string; action: string; target: string | null };

test.describe("M09 resolve segnale abbandono -> DB + audit event", () => {
  let signalId: string;
  let brandId: string;
  let contactId: string;

  test.beforeAll(async () => {
    const admin = getAdmin();
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    brandId = (brand as { id: string }).id;

    const { data: contact } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .is("archived_at", null)
      .is("is_duplicate_of", null)
      .limit(1)
      .maybeSingle();
    contactId = (contact as { id: string }).id;
  });

  test.beforeEach(async () => {
    const admin = getAdmin();
    // Pulizia residui test precedenti sullo stesso contact + kind (UNIQUE partial)
    await admin
      .from("abandonment_signals")
      .delete()
      .eq("contact_id", contactId)
      .eq("kind", "silence_gap")
      .is("resolved_at", null);

    const windowEnd = new Date();
    const windowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const { data, error } = await admin
      .from("abandonment_signals")
      .insert({
        organization_id: DEMO_ORG_ID,
        brand_id: brandId,
        contact_id: contactId,
        kind: "silence_gap",
        severity: "medium",
        signal_at: new Date().toISOString(),
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        previous_orders_count: 5,
        current_orders_count: 0,
        notes: "[E2E] signal di test",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Insert signal fallito: ${error?.message}`);
    signalId = (data as { id: string }).id;
  });

  test.afterEach(async () => {
    const admin = getAdmin();
    if (signalId) {
      await admin.from("abandonment_signals").delete().eq("id", signalId);
    }
    // Cleanup audit events del test
    await admin
      .from("audit_events")
      .delete()
      .eq("organization_id", DEMO_ORG_ID)
      .eq("action", "abandonment.resolved")
      .eq("target", `signal:${signalId}`);
  });

  test("risolve signal attivo -> resolved_at + resolved_reason + audit event scritto", async ({
    page,
  }) => {
    await page.goto("/anti-abbandono");

    // Trova la riga con il nostro signal (match sulla cella Note)
    const row = page.locator("table tbody tr").filter({ hasText: "[E2E] signal di test" });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click bottone Risolvi sulla riga -> apre modal
    await row.getByRole("button", { name: /risolvi/i }).click();

    // Verifica modal aperto
    await expect(page.getByRole("heading", { name: /risolvi segnale/i })).toBeVisible();

    // Compila textarea motivo (min 3 char richiesto)
    const reason = "E2E test resolve: cliente contattato telefonicamente e ha spiegato il problema";
    await page.locator("textarea").fill(reason);

    // Click Conferma risoluzione
    await page.getByRole("button", { name: /conferma risoluzione/i }).click();

    // Il modal si chiude e la riga sparisce dall'elenco attivi
    await expect(page.getByRole("heading", { name: /risolvi segnale/i })).not.toBeVisible({
      timeout: 10_000,
    });

    // Verifica DB: resolved_at + resolved_reason
    const admin = getAdmin();
    const { data: afterResolve } = await admin
      .from("abandonment_signals")
      .select("id, resolved_at, resolved_reason")
      .eq("id", signalId)
      .maybeSingle();
    const sig = afterResolve as SignalRow | null;
    expect(sig?.resolved_at).not.toBeNull();
    expect(sig?.resolved_reason).toBe(reason);

    // Verifica audit event
    const { data: audit } = await admin
      .from("audit_events")
      .select("id, action, target")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("target", `signal:${signalId}`)
      .eq("action", "abandonment.resolved")
      .maybeSingle();
    const auditRow = audit as AuditRow | null;
    expect(auditRow).not.toBeNull();
    expect(auditRow?.action).toBe("abandonment.resolved");
  });

  test("resolve con motivo < 3 char -> errore validazione", async ({ page }) => {
    await page.goto("/anti-abbandono");
    const row = page.locator("table tbody tr").filter({ hasText: "[E2E] signal di test" });
    await row.getByRole("button", { name: /risolvi/i }).click();

    // Compila con 2 char
    await page.locator("textarea").fill("ok");
    await page.getByRole("button", { name: /conferma risoluzione/i }).click();

    // Modal resta aperto + errore visibile
    await expect(page.getByRole("heading", { name: /risolvi segnale/i })).toBeVisible();
    await expect(page.getByText(/almeno 3 caratteri/i)).toBeVisible();

    // DB immutato
    const admin = getAdmin();
    const { data } = await admin
      .from("abandonment_signals")
      .select("resolved_at")
      .eq("id", signalId)
      .maybeSingle();
    expect((data as SignalRow).resolved_at).toBeNull();
  });
});
