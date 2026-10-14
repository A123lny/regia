// Anti-abbandono (M09) smoke — page load + segnali visibili.

import { test, expect } from "@playwright/test";

test("Anti-abbandono carica con heading corretta", async ({ page }) => {
  await page.goto("/anti-abbandono");
  await expect(page.locator("h1").filter({ hasText: /anti.?abbandono/i })).toBeVisible();
});

test("Anti-abbandono mostra almeno un segnale (seed popolato)", async ({ page }) => {
  await page.goto("/anti-abbandono");
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  expect(await rows.count()).toBeGreaterThan(0);
});

test("Anti-abbandono bottone 'Ricalcola segnali' visibile per Owner", async ({ page }) => {
  await page.goto("/anti-abbandono");
  await expect(page.getByRole("button", { name: /ricalcola/i })).toBeVisible();
});
