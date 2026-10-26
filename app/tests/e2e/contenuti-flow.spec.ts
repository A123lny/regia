// E2E deep flow M03: draft -> approve -> schedule.
//
// Pattern: inseriamo la bozza via DB admin (evita chiamata reale ad Anthropic
// durante il test, risparmia tempo + costo + rimuove flakiness), poi testiamo
// via UI il ciclo approve + schedule, verificando le transizioni di stato in DB.
//
// Cleanup finale (anche su fallimento) per non lasciare detriti nel seed.

import { test, expect } from "@playwright/test";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type DraftRow = {
  id: string;
  status: string;
  approved_at: string | null;
  scheduled_at: string | null;
};

test.describe("M03 flow editoriale draft -> approve -> schedule", () => {
  // IDs riusati tra i test
  let draftId: string;
  let lennyBrandId: string;

  test.beforeAll(async () => {
    const admin = getAdmin();
    const { data: brand, error } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    if (error || !brand) throw new Error(`Brand lenny non trovato: ${error?.message}`);
    lennyBrandId = (brand as { id: string }).id;
  });

  test.beforeEach(async () => {
    // Seed di una bozza fresca per ogni test (status=draft).
    // Usiamo valori minimi che rispettino i check constraint:
    // - theme_input e generated_text: 1..2000 / 1..10000 char
    // - tokens_in/out >= 0, cost_usd >= 0, latency_ms >= 0
    // - prompt_version / model_used: 1..100 char
    const admin = getAdmin();
    const { data, error } = await admin
      .from("content_drafts")
      .insert({
        organization_id: DEMO_ORG_ID,
        brand_id: lennyBrandId,
        channel: "social",
        theme_input: `[E2E test ${Date.now()}] Promo pizza martedi`,
        generated_text:
          "Promo pizza martedi: 2x1 su tutte le pizze dalle 19 alle 22. Prenota al 0541-123456.",
        prompt_version: "e2e-test",
        model_used: "e2e-mock",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Insert draft fallito: ${error?.message}`);
    draftId = (data as { id: string }).id;
  });

  test.afterEach(async () => {
    // Cleanup: cancella la bozza del test. Il CASCADE sulle FK cleanup
    // automatico voucher attribuiti / material_requests / ecc.
    const admin = getAdmin();
    if (draftId) {
      await admin.from("content_drafts").delete().eq("id", draftId);
    }
  });

  test("flow completo: draft visibile -> Approva -> status=approved + approved_at non-null", async ({
    page,
  }) => {
    // 1. Vai al detail della bozza appena seedata
    await page.goto(`/contenuti/lenny/${draftId}`);

    // 2. Verifica che la pagina mostri il chip "Bozza"
    await expect(page.getByText("Bozza", { exact: true }).first()).toBeVisible();

    // 3. Click bottone Approva
    const approveBtn = page.getByRole("button", { name: /approva/i }).first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 4. Dopo la server action + revalidate la pagina si ricarica
    //    Verifica chip "Approvato"
    await expect(page.getByText("Approvato", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // 5. Verifica DB: status=approved + approved_at non null
    const admin = getAdmin();
    const { data: afterApprove } = await admin
      .from("content_drafts")
      .select("status, approved_at, scheduled_at")
      .eq("id", draftId)
      .maybeSingle();
    const row = afterApprove as DraftRow | null;
    expect(row?.status).toBe("approved");
    expect(row?.approved_at).not.toBeNull();
    expect(row?.scheduled_at).toBeNull();
  });

  test("flow completo: approved -> Programma data futura -> status=scheduled + scheduled_at coerente", async ({
    page,
  }) => {
    // Pre-step: imposta la bozza direttamente ad approved via DB per saltare
    // il click Approva (gia' coperto dal test precedente). Rapido.
    const admin = getAdmin();
    await admin
      .from("content_drafts")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", draftId);

    // 1. Vai al detail
    await page.goto(`/contenuti/lenny/${draftId}`);

    // 2. Dovresti vedere lo ScheduleDraftForm (campo datetime-local + bottone Programma)
    const scheduleInput = page.locator('input[name="scheduledAt"]');
    await expect(scheduleInput).toBeVisible();

    // 3. Compila con data futura (+3 giorni, 15:00 locale)
    const future = new Date();
    future.setDate(future.getDate() + 3);
    future.setHours(15, 0, 0, 0);
    const localIso = new Date(future.getTime() - future.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    await scheduleInput.fill(localIso);

    // 4. Click "Programma"
    const scheduleBtn = page.getByRole("button", { name: /^programma(?:ndo)?/i });
    await scheduleBtn.click();

    // 5. Verifica chip "Programmato"
    await expect(page.getByText("Programmato", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // 6. Verifica DB: status=scheduled + scheduled_at coerente (entro 1 min dalla data scelta)
    const { data: afterSchedule } = await admin
      .from("content_drafts")
      .select("status, scheduled_at")
      .eq("id", draftId)
      .maybeSingle();
    const row = afterSchedule as DraftRow | null;
    expect(row?.status).toBe("scheduled");
    expect(row?.scheduled_at).not.toBeNull();
    const diffMs = Math.abs(new Date(row!.scheduled_at!).getTime() - future.getTime());
    expect(diffMs).toBeLessThan(60_000);
  });
});
