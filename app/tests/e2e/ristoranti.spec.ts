// Ristoranti Lenny (M07 partner_restaurants) smoke.

import { test, expect } from "@playwright/test";

test("Ristoranti Lenny carica con heading", async ({ page }) => {
  await page.goto("/ristoranti");
  await expect(page.locator("h1").filter({ hasText: /ristorant|lenny/i })).toBeVisible();
});

test("Ristoranti mostra la lista partner (5 dal seed)", async ({ page }) => {
  await page.goto("/ristoranti");
  const rows = page.locator("table tbody tr, article");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
});

test("Mercato categorie carica senza errori", async ({ page }) => {
  await page.goto("/ristoranti/mercato");
  await expect(page.locator("h1").filter({ hasText: /mercato/i })).toBeVisible();
});
