// Impostazioni (M11 admin + config) smoke.

import { test, expect } from "@playwright/test";

test("Impostazioni landing carica", async ({ page }) => {
  await page.goto("/impostazioni");
  await expect(page.locator("h1").filter({ hasText: /impostazion|config/i })).toBeVisible();
});

test("Memoria agente carica", async ({ page }) => {
  await page.goto("/impostazioni/memoria-agente");
  await expect(page.locator("h1").filter({ hasText: /memoria|agente/i })).toBeVisible();
});

test("Provider media carica", async ({ page }) => {
  await page.goto("/impostazioni/provider-media");
  await expect(page.locator("h1").filter({ hasText: /provider|media/i })).toBeVisible();
});

test("Audit log carica", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.locator("h1").filter({ hasText: /audit|log/i })).toBeVisible();
});
