import { defineConfig } from "@playwright/test";

// FBL-034 — ultrawide performance validation.
//
// This is deliberately a *separate* Playwright config from
// playwright.config.ts, for three reasons that all come down to
// measuring the right thing:
//
//  1. **Serial, not parallel.** The functional suite runs `fullyParallel`
//     with one worker per core, which means a dozen browsers each
//     rendering a 7.4M-pixel canvas at once. That is the correct way to
//     *stress* the app (and FBL-034 requires the functional suite to
//     survive exactly that), but it is a meaningless way to *measure* it:
//     the number you get back is the machine contending with itself, not
//     the frame rate an operator sees. Measurement runs one at a time.
//
//  2. **Production build, not `next dev`.** Dev-mode React ships
//     development warnings, no minification, and per-render bookkeeping
//     the operator never pays for. Measuring `next dev` and reporting it
//     as the product's performance would overstate the cost.
//
//  3. **No `NEXT_PUBLIC_E2E`.** That flag turns on
//     `preserveDrawingBuffer`, which exists only so the functional suite
//     can read back canvas pixels, and which disables a real GPU
//     optimization. The performance suite must measure the rendering path
//     the operator actually gets.
//
// Headless, but GPU-backed. Chromium on macOS defaults to SwiftShader —
// software rasterization — and a frame rate measured that way describes a
// software rasteriser, not the target Mac. `--use-angle=metal` gets the
// real Apple GPU while staying headless, so the measurement is
// representative without commandeering the operator's screen.
//
// This is not taken on trust: `assertMeasuringAtViewport` reads back the
// live WebGL renderer string and fails the run if it is a software
// device. A budget "met" under SwiftShader would be a false pass, and a
// false pass recorded as evidence is worse than no measurement.
//
// `PERF_HEADED=1` runs headed, for eyeballing what is being measured.
const VIEWPORTS = {
  "ultrawide-5120x1440": { width: 5120, height: 1440 },
  "ultrawide-3840x1080": { width: 3840, height: 1080 },
  "fallback-2560x1440": { width: 2560, height: 1440 },
} as const;

const PORT = 4400;
const headless = process.env.PERF_HEADED !== "1";
const gpuArgs =
  process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : [];

export default defineConfig({
  testDir: "./e2e-perf",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // A performance budget that only passes on a retry has not been met.
  // Retries here would launder a miss into a pass.
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless,
    launchOptions: { args: gpuArgs },
  },
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    ...Object.entries(VIEWPORTS).map(([name, viewport]) => ({
      name,
      use: { viewport },
    })),
    // Supplementary, beyond the three required viewports: the primary
    // target on a HiDPI-scaled display, where the same 5120×1440 of layout
    // is backed by four times the pixels. The operator's own machine can
    // present the panel this way, so the budget is checked against the
    // more expensive of the two possibilities rather than the flattering
    // one. Failures here are real, not a stricter grade of the same test.
    {
      name: "ultrawide-5120x1440-hidpi",
      use: { viewport: VIEWPORTS["ultrawide-5120x1440"], deviceScaleFactor: 2 },
    },
  ],
});
