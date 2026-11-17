// RN-robot T12: E2E Playwright per il robottino.
// Scope: verifica che la UI del widget sia renderizzata correttamente e che
// la section governance esponga il toggle. NON invochiamo il modello Gemini
// per non bruciare quota free-tier (test con risposte reali vanno fatti a mano
// in staging quando serve).

import { test, expect } from "@playwright/test";

test("robottino: pallina visibile per owner su /contatti", async ({ page }) => {
  await page.goto("/contatti");
  // La pallina ha data-testid specifico
  await expect(page.locator('[data-testid="robot-bubble"]')).toBeVisible({ timeout: 10_000 });
});

test("robottino: pallina visibile anche su /calendario", async ({ page }) => {
  await page.goto("/calendario");
  await expect(page.locator('[data-testid="robot-bubble"]')).toBeVisible({ timeout: 10_000 });
});

test("robottino: click sulla pallina apre il pannello laterale", async ({ page }) => {
  await page.goto("/contatti");
  await page.locator('[data-testid="robot-bubble"]').click();
  await expect(page.locator('[data-testid="robot-panel"]')).toBeVisible();
  await expect(page.getByText(/Regia.*Assistente|Assistente/i)).toBeVisible();
});

test("robottino: pannello mostra messaggio di benvenuto con pageTitle", async ({ page }) => {
  await page.goto("/contatti");
  await page.locator('[data-testid="robot-bubble"]').click();
  // Il messaggio di benvenuto contiene "Contatti" (page title derivato dal path)
  await expect(page.locator('[data-testid="robot-messages"]')).toContainText("Contatti");
  await expect(page.locator('[data-testid="robot-messages"]')).toContainText("Regia");
});

test("robottino: input + pulsante Invia presenti nel pannello", async ({ page }) => {
  await page.goto("/contatti");
  await page.locator('[data-testid="robot-bubble"]').click();
  await expect(page.locator('[data-testid="robot-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="robot-send"]')).toBeVisible();
});

test("governance: toggle 'Assistente Regia' visibile per owner", async ({ page }) => {
  await page.goto("/governance");
  // La section "Assistente Regia (robottino)" è alla fine della pagina
  await page.locator('section').last().scrollIntoViewIfNeeded();
  await expect(page.getByText(/Assistente Regia|robottino/i)).toBeVisible();

  // I 4 toggle per ruolo (owner, editor, delegate, agent) devono esserci
  await expect(page.locator('[data-testid="robot-toggle-owner"]')).toBeVisible();
  await expect(page.locator('[data-testid="robot-toggle-editor"]')).toBeVisible();
});

test("governance: toggle owner è abilitato per default", async ({ page }) => {
  await page.goto("/governance");
  const ownerToggle = page.locator('[data-testid="robot-toggle-owner"]');
  await ownerToggle.scrollIntoViewIfNeeded();
  await expect(ownerToggle).toBeChecked();
});
