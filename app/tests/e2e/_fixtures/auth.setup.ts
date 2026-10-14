import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// Login dell'Owner esistente: l'app usa email+password (non magic link),
// quindi il setup resetta la password dell'Owner ad una stringa random
// generata al momento (mai persistita in repo), poi compila /login e
// serializza il cookie di sessione in storageState.
// La password viene usata solo in-memory nel processo di test: dopo il
// resetta il storageState che e' in gitignore e sufficiente ai run futuri.
// E2E_OWNER_PASSWORD env var e' opzionale, utile per debug manuale.

const OWNER_EMAIL = process.env["E2E_OWNER_EMAIL"] ?? "owner@regia.local";
const OWNER_PASSWORD =
  process.env["E2E_OWNER_PASSWORD"] ?? crypto.randomBytes(24).toString("base64url");
const STORAGE_PATH = path.resolve("./tests/e2e/.auth/owner.json");

setup("authenticate as owner", async ({ page }) => {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti. Lancia con `dotenv -e .env.staging`.",
    );
  }
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  // Risolvi userId dall'email per aggiornare la password.
  // listUsers restituisce fino a 1000; per F1 e' sufficiente (singolo tenant).
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const owner = users.users.find((u) => u.email === OWNER_EMAIL);
  if (!owner) throw new Error(`Owner con email ${OWNER_EMAIL} non trovato`);
  const { error: updErr } = await admin.auth.admin.updateUserById(owner.id, {
    password: OWNER_PASSWORD,
  });
  if (updErr) throw new Error(`updateUserById: ${updErr.message}`);
  console.log(`[auth.setup] password Owner reset per ${OWNER_EMAIL}`);

  // Login via form.
  await page.goto("/login");
  await page.locator("#email").fill(OWNER_EMAIL);
  await page.locator("#password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.locator("h1").filter({ hasText: /buongiorno/i })).toBeVisible();

  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_PATH });
  console.log(`[auth.setup] storageState salvato in ${STORAGE_PATH}`);
});
