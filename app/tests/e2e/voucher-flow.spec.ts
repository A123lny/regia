// E2E deep flow M06: voucher issue -> redeem idempotente (RF-6.26).
//
// Pattern: creiamo l'offerta + voucher issued via DB admin, poi testiamo via UI
// il riscatto. Secondo riscatto dello stesso codice deve fallire (idempotenza).
//
// Cleanup finale per non lasciare detriti.

import { test, expect } from "@playwright/test";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

type VoucherRow = {
  id: string;
  status: string;
  redeemed_at: string | null;
};

test.describe("M06 voucher issue -> redeem idempotente (RF-6.26)", () => {
  let offerId: string;
  let voucherId: string;
  let voucherCode: string;
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
      .limit(1)
      .maybeSingle();
    contactId = (contact as { id: string }).id;
  });

  test.beforeEach(async () => {
    const admin = getAdmin();
    // Offerta demo (percentuale 10% sulla pizza)
    const { data: offer } = await admin
      .from("voucher_offers")
      .insert({
        organization_id: DEMO_ORG_ID,
        issuer_brand_id: brandId,
        spendable_brand_id: brandId,
        name: `[E2E ${Date.now()}] 10% pizza test`,
        reward_kind: "percentuale",
        reward_pct: 10,
        default_expires_days: 60,
        is_active: true,
      })
      .select("id")
      .single();
    offerId = (offer as { id: string }).id;

    // Voucher issued con codice univoco
    voucherCode = `E2E${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
    const { data: voucher } = await admin
      .from("vouchers")
      .insert({
        organization_id: DEMO_ORG_ID,
        offer_id: offerId,
        contact_id: contactId,
        code: voucherCode,
        reward_kind: "percentuale",
        reward_pct: 10,
        status: "issued",
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();
    voucherId = (voucher as { id: string }).id;
  });

  test.afterEach(async () => {
    const admin = getAdmin();
    if (voucherId) await admin.from("vouchers").delete().eq("id", voucherId);
    if (offerId) await admin.from("voucher_offers").delete().eq("id", offerId);
  });

  test("primo riscatto: status -> redeemed + redeemed_at set + messaggio success", async ({
    page,
  }) => {
    await page.goto("/fedelta");

    // Tab "Riscatta"
    await page
      .getByRole("button", { name: /^riscatta$/i })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: /riscatta al banco/i })).toBeVisible();

    // Compila codice e click Riscatta
    await page.locator("#code").fill(voucherCode);
    await page
      .getByRole("button", { name: /^riscatta$/i })
      .last()
      .click();

    // Verifica messaggio success
    await expect(page.getByText(/voucher riscattato/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Verifica DB: status=redeemed + redeemed_at non null
    const admin = getAdmin();
    const { data } = await admin
      .from("vouchers")
      .select("status, redeemed_at")
      .eq("id", voucherId)
      .maybeSingle();
    const row = data as VoucherRow | null;
    expect(row?.status).toBe("redeemed");
    expect(row?.redeemed_at).not.toBeNull();
  });

  test("secondo riscatto dello stesso codice: errore 'gia riscattato' (idempotenza RF-6.26)", async ({
    page,
  }) => {
    // Pre-step: riscatta direttamente via DB per saltare il primo UI click
    const admin = getAdmin();
    await admin
      .from("vouchers")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
      .eq("id", voucherId);

    await page.goto("/fedelta");
    await page
      .getByRole("button", { name: /^riscatta$/i })
      .first()
      .click();
    await page.locator("#code").fill(voucherCode);
    await page
      .getByRole("button", { name: /^riscatta$/i })
      .last()
      .click();

    // Devi vedere un messaggio di errore (border rosso)
    const errorMsg = page.locator(".border-danger\\/40");
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });

    // DB: status rimane redeemed (immutato)
    const { data } = await admin
      .from("vouchers")
      .select("status")
      .eq("id", voucherId)
      .maybeSingle();
    expect((data as VoucherRow).status).toBe("redeemed");
  });

  test("codice inesistente: errore 'voucher non trovato'", async ({ page }) => {
    await page.goto("/fedelta");
    await page
      .getByRole("button", { name: /^riscatta$/i })
      .first()
      .click();
    await page.locator("#code").fill("CODICEINEXISTENTE");
    await page
      .getByRole("button", { name: /^riscatta$/i })
      .last()
      .click();

    const errorMsg = page.locator(".border-danger\\/40");
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });
  });
});
