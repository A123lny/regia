// Iscrizioni (M10 landing + signup) smoke.

import { test, expect } from "@playwright/test";

test("Iscrizioni carica con heading", async ({ page }) => {
  await page.goto("/iscrizioni");
  await expect(page.locator("h1").filter({ hasText: /iscrizion|landing|signup/i })).toBeVisible();
});

test("Landing /iscriviti/<slug> è pubblica (seed benvenuto-lenny)", async ({ page }) => {
  // La landing deve essere accessibile anche senza auth: usiamo un nuovo contesto
  // senza storageState per emulare un visitatore anonimo
  const anonContext = await page.context().browser()!.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto("http://localhost:3000/iscriviti/benvenuto-lenny");
  await expect(
    anonPage
      .locator("body")
      .filter({ hasText: /iscriviti|benvenuto|lenny/i })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
  await anonContext.close();
});
