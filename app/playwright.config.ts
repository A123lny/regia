import { defineConfig, devices } from "@playwright/test";
import * as path from "node:path";

// RF-12.1 E2E: Playwright config.
// - Target: localhost:3000 lanciato con env staging (Supabase Cloud).
// - Auth: setup project genera storageState riusato da tutti i test.
// - Niente parallelismo per F1 (dati condivisi + singolo seed demo).

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.output",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["html", { outputFolder: "./tests/e2e/.report", open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /_fixtures\/auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.resolve("./tests/e2e/.auth/owner.json"),
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev:staging",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
