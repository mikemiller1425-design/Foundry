import { defineConfig } from "@playwright/test";

// Target viewports per docs/02-specification/interface-model.md
// "Target resolutions": preferred, supported, and usable-fallback.
const VIEWPORTS = {
  "ultrawide-5120x1440": { width: 5120, height: 1440 },
  "ultrawide-3840x1080": { width: 3840, height: 1080 },
  "fallback-2560x1440": { width: 2560, height: 1440 },
} as const;

const PORT = 4300;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    // NEXT_PUBLIC_E2E=1 is read by WorldCanvas.tsx to enable
    // `preserveDrawingBuffer` only for this dev server — real dev/build
    // runs never set it, so production rendering never pays that cost.
    // It exists solely so Playwright can read back real canvas pixels
    // (shell-environment.spec.ts, shell-lighthouse.spec.ts).
    command: `NEXT_PUBLIC_E2E=1 pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
    name,
    use: { viewport },
  })),
});
