// Contenuti (M03) smoke.

import { test, expect } from "@playwright/test";

test("Contenuti carica con heading", async ({ page }) => {
  await page.goto("/contenuti");
  await expect(page.locator("h1").filter({ hasText: /contenut|bozz/i })).toBeVisible();
});

test("Contenuti mostra bozze dal seed (20)", async ({ page }) => {
  await page.goto("/contenuti");
  // Attendi che almeno una card bozza sia visibile
  const anyDraft = page.locator("article, [data-testid*='draft'], tr").first();
  await expect(anyDraft).toBeVisible({ timeout: 10_000 });
});
