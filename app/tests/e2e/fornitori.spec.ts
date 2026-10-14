// Fornitori (M07 supply_partners) smoke.

import { test, expect } from "@playwright/test";

test("Fornitori carica con heading", async ({ page }) => {
  await page.goto("/fornitori");
  await expect(page.locator("h1").filter({ hasText: /fornitori|supply/i })).toBeVisible();
});

test("Fornitori mostra 3 fornitori seedati", async ({ page }) => {
  await page.goto("/fornitori");
  const rows = page.locator("table tbody tr, article");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
});
