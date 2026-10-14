// Contatti (M01) smoke.

import { test, expect } from "@playwright/test";

test("Contatti carica con heading", async ({ page }) => {
  await page.goto("/contatti");
  await expect(page.locator("h1").filter({ hasText: /contatt/i })).toBeVisible();
});

test("Contatti mostra almeno un contatto dal seed (30)", async ({ page }) => {
  await page.goto("/contatti");
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  expect(await rows.count()).toBeGreaterThan(0);
});
