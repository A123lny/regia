// Governance (M13) smoke — advertising budget + zones + capacità rider.

import { test, expect } from "@playwright/test";

test("Governance landing carica", async ({ page }) => {
  await page.goto("/governance");
  await expect(page.locator("h1").filter({ hasText: /governance|regole/i })).toBeVisible();
});

test("Zone consegna carica", async ({ page }) => {
  await page.goto("/governance/zone-consegna");
  await expect(page.locator("h1").filter({ hasText: /zone|consegna/i })).toBeVisible();
});

test("Capacita rider carica", async ({ page }) => {
  await page.goto("/governance/capacita-rider");
  await expect(page.locator("h1").filter({ hasText: /capacit|rider/i })).toBeVisible();
});

test("Advertising budget carica", async ({ page }) => {
  await page.goto("/governance/advertising");
  await expect(page.locator("h1").filter({ hasText: /advertising|budget/i })).toBeVisible();
});
