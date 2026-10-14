// Dashboard (M12) smoke — page load + core elements.

import { test, expect } from "@playwright/test";

test("Dashboard carica e mostra task list card", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("h1").filter({ hasText: /buongiorno/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /da fare/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /nuovo task/i })).toBeVisible();
});

test("Dashboard mostra sezione 'Segnali di sistema' con seed", async ({ page }) => {
  await page.goto("/dashboard");
  const segnali = page.getByText(/segnali di sistema/i).first();
  await expect(segnali).toBeVisible({ timeout: 10_000 });
});

test("Dashboard tab 'Completati' si clicca senza errori", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Completati" }).click();
  // Dopo il click la pagina non deve essere in errore 500 (verifica banner errore)
  await expect(page.locator("h1").filter({ hasText: /buongiorno/i })).toBeVisible();
});
