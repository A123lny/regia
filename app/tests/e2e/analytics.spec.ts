// Analytics (M08) smoke.

import { test, expect } from "@playwright/test";

test("Analytics carica con heading", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.locator("h1").filter({ hasText: /analytics|insight|metriche/i })).toBeVisible();
});
