// Marchi (M02) smoke.

import { test, expect } from "@playwright/test";

test("Marchi carica con heading + lista brands", async ({ page }) => {
  await page.goto("/marchi");
  await expect(page.locator("h1").filter({ hasText: /march/i })).toBeVisible();
  // Almeno un brand (Lenny esiste nel seed)
  await expect(page.getByText(/lenny/i).first()).toBeVisible({ timeout: 10_000 });
});
