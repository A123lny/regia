// Fedeltà (M06) smoke.

import { test, expect } from "@playwright/test";

test("Fedelta carica con heading", async ({ page }) => {
  await page.goto("/fedelta");
  await expect(page.locator("h1").filter({ hasText: /fedel|voucher/i })).toBeVisible();
});

test("Fedelta mostra almeno un voucher o la lista offerte dal seed", async ({ page }) => {
  await page.goto("/fedelta");
  // 20 voucher + 3 offerte seedate: almeno una riga nella tabella
  const rows = page.locator("tbody tr, article");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
});
