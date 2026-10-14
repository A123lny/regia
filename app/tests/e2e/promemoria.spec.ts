// Promemoria (M09) smoke.

import { test, expect } from "@playwright/test";

test("Promemoria carica con heading + 4 KPI card", async ({ page }) => {
  await page.goto("/promemoria");
  await expect(page.locator("h1").filter({ hasText: /promemoria/i })).toBeVisible();
  await expect(page.getByText(/da fare oggi/i).first()).toBeVisible();
  await expect(page.getByText(/prossimi 7 giorni/i).first()).toBeVisible();
});

test("Promemoria mostra filtri + bottone 'Filtra'", async ({ page }) => {
  await page.goto("/promemoria");
  await expect(page.getByRole("button", { name: /^filtra$/i })).toBeVisible();
});

test("Promemoria con status=pending mostra tabella seed", async ({ page }) => {
  await page.goto("/promemoria?status=pending");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
});
