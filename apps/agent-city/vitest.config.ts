import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Playwright owns both browser directories: `e2e/` (functional) and
    // `e2e-perf/` (FBL-034 performance budgets, run serially against a
    // production build via playwright.perf.config.ts). Vitest collecting
    // them would fail on Playwright's own test API rather than reporting
    // anything about the code.
    exclude: ["**/node_modules/**", "**/e2e/**", "**/e2e-perf/**"],
  },
});
