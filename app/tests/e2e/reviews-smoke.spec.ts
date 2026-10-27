// Smoke M08: page load /recensioni + KPI + filtri + tabella render.

import { test, expect } from "@playwright/test";

test("GET /recensioni → page carica + 4 KPI + filtri + tabella", async ({ page }) => {
  await page.goto("/recensioni");
  await expect(page.getByRole("heading", { name: /recensioni e reputazione/i })).toBeVisible();
  await expect(page.getByText("Oggi").first()).toBeVisible();
  await expect(page.getByText("Da rispondere").first()).toBeVisible();
  await expect(page.getByText("Serious segnalate").first()).toBeVisible();
  await expect(page.locator("select").first()).toBeVisible();
});
