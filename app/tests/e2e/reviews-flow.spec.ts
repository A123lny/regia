// E2E deep flow M08: inserisci review positive via admin + apri drawer + approva + mark published.

import { test, expect } from "@playwright/test";
import { getAdmin, DEMO_ORG_ID } from "./_fixtures/db";

test.describe("M08 review flow (approve → mark published)", () => {
  let reviewId: string;

  test.beforeEach(async () => {
    const admin = getAdmin();
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", DEMO_ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    const brandId = (brand as { id: string }).id;

    const { data } = await admin
      .from("reviews")
      .insert({
        organization_id: DEMO_ORG_ID,
        brand_id: brandId,
        source: "google",
        external_id: `e2e-${Date.now()}`,
        author_name: "E2EMario",
        rating: 5,
        text_original: "Ottima esperienza E2E test",
        posted_at: new Date().toISOString(),
        classification: "positive",
        classification_reason: "rating:5",
        suggested_reply: "Grazie mille per il feedback!",
        status: "draft_ready",
      })
      .select("id")
      .single();
    reviewId = (data as { id: string }).id;
  });

  test.afterEach(async () => {
    const admin = getAdmin();
    if (reviewId) await admin.from("reviews").delete().eq("id", reviewId);
  });

  test("apri drawer → approva → mark published → DB verificato", async ({ page }) => {
    await page.goto("/recensioni?status=draft_ready");

    const row = page.locator("table tbody tr").filter({ hasText: "E2EMario" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: /apri/i }).click();

    await expect(page.getByRole("dialog").getByText("E2EMario")).toBeVisible();
    await page.getByRole("button", { name: /approva risposta/i }).click();

    // Drawer si aggiorna; stato ora 'approved'
    await expect(page.getByText(/risposta approvata/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /fatto, pubblicata/i }).click();

    const admin = getAdmin();
    const { data } = await admin
      .from("reviews")
      .select("status, approved_reply, published_externally_at")
      .eq("id", reviewId)
      .maybeSingle();
    expect((data as { status: string }).status).toBe("published_externally");
    expect((data as { approved_reply: string }).approved_reply).toBeTruthy();
    expect(
      (data as { published_externally_at: string | null }).published_externally_at,
    ).not.toBeNull();
  });
});
