import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 15_000,
    // I test invarianti condividono il DB locale: esecuzione sequenziale per
    // evitare race condition (brand temporanei di un test visibili ad altri).
    fileParallelism: false,
    environmentMatchGlobs: [
      ["tests/ui/**/*.test.tsx", "jsdom"],
      ["**/*.test.ts", "node"],
    ],
  },
});
