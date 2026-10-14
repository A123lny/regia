// Altre pagine protette: catalogo, ordini, segmenti, campagne, team.

import { test, expect } from "@playwright/test";

test("Catalogo carica", async ({ page }) => {
  await page.goto("/catalogo");
  await expect(page.locator("h1").filter({ hasText: /catalog|prodott/i })).toBeVisible();
});

test("Ordini carica", async ({ page }) => {
  await page.goto("/ordini");
  await expect(page.locator("h1").filter({ hasText: /ordini/i })).toBeVisible();
});

test("Segmenti carica", async ({ page }) => {
  await page.goto("/segmenti");
  await expect(page.locator("h1").filter({ hasText: /segment/i })).toBeVisible();
});

test("Campagne carica", async ({ page }) => {
  await page.goto("/campagne");
  await expect(page.locator("h1").filter({ hasText: /campagn/i })).toBeVisible();
});

test("Team carica", async ({ page }) => {
  await page.goto("/team");
  await expect(page.locator("h1").filter({ hasText: /team|utent/i })).toBeVisible();
});
