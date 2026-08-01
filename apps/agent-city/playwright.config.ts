import { defineConfig } from "@playwright/test";

// Target viewports per docs/02-specification/interface-model.md
// "Target resolutions": preferred, supported, and usable-fallback.
const VIEWPORTS = {
  "ultrawide-5120x1440": { width: 5120, height: 1440 },
  "ultrawide-3840x1080": { width: 3840, height: 1080 },
  "fallback-2560x1440": { width: 2560, height: 1440 },
} as const;

const PORT = 4300;

// FBL-034 — why these flags exist.
//
// Headless Chromium on macOS defaults to SwiftShader: WebGL is rasterized
// in *software*, on the CPU. For an application whose main surface is a 3D
// world that is not a small overhead — each browser burns a core drawing a
// ~3.1M-pixel canvas, so N parallel workers starve each other, and the
// demo runtime's `setTimeout` pacing (a floor, never a promise) stretches
// with the load. Measured at 5120×1440, time for the demo to reach the
// approval gate:
//
//   software (SwiftShader)   1 worker: ~12s    8 workers: ~42s
//   GPU (ANGLE/Metal)        1 worker:  ~6s    8 workers: ~10s
//
// At 8 workers the software figure is past the 30 s the approval-gate
// specs allow, which is the FBL-028 §12.7 flakiness: different specs
// failed on different runs because whichever ones happened to be waiting
// on demo progress when the machine was busiest lost the race.
//
// Requesting the real GPU is a *root-cause* fix, not a tolerance
// adjustment: no timeout was raised and no test is retried. It also makes
// the harness representative — the operator's browser is GPU-backed, so a
// suite rasterizing in software was measuring a machine nobody runs.
//
// The flag is a request, not a requirement: where Metal is unavailable
// ANGLE falls back to its default backend and the suite still runs, just
// more slowly. It is scoped to macOS because that is where the fallback
// is SwiftShader and where Metal is the right backend to ask for.
const gpuArgs =
  process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : [];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { args: gpuArgs },
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
