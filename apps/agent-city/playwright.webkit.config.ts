import { defineConfig, devices } from "@playwright/test";

// FBL-035 — Safari/WebKit coverage.
//
// `v1-acceptance.md` § "Test environment" names **current Chrome and
// Safari**. Every rung from FBL-001 to FBL-034 specified Chromium-based
// Playwright projects only, so Safari was never exercised by automation —
// a coverage gap the terminal acceptance rung exists to catch.
//
// This config runs the same functional suite against WebKit at the three
// target viewports. It is kept separate from `playwright.config.ts`
// because its results are not yet clean: three issues are open against
// Safari (recorded in docs/evidence/fbl-035/v1-acceptance-report.md §7).
// Folding it into the default suite would either turn the default red or
// invite the failures to be silenced; keeping it explicit keeps the gap
// visible and reproducible:
//
//   pnpm exec playwright test --config=playwright.webkit.config.ts
//
// AC-103 — why `workers` is pinned here.
//
// Finding 6 was three WebKit failures accepted at FBL-035 without
// diagnosis. They are **worker-contention artifacts**, and this line is
// the root-cause fix.
//
// FBL-034 measured the mechanism for Chromium and repaired it by asking
// for the real GPU (`--use-angle=metal`). Those are Chromium switches;
// WebKit ignores them, so a WebKit run is always software-rasterized —
// exactly the regime where FBL-034 measured 1 worker ~12s against
// 8 workers ~42s for the demo to reach the approval gate. Specs that
// drive the demo and assert on elapsed progress, or that poll for the
// camera to settle, lose that race when the machine is over-subscribed.
//
// The cap was documented in `apps/agent-city/README.md` as prose
// (`--workers=3`) and was therefore not applied by the FBL-035 run,
// which used Playwright's default (half the cores). Reliability that
// depends on remembering a flag is not reliability; `F-131` requires it
// to be a property of the suite, not of the machine or the operator.
//
// This raises no timeout, skips no test, and retries nothing. See
// `docs/evidence/ac-103/finding-6-diagnosis.md` for the two runs that
// establish it.
const WORKERS = 3;

const VIEWPORTS = {
  "webkit-5120x1440": { width: 5120, height: 1440 },
  "webkit-3840x1080": { width: 3840, height: 1080 },
  "webkit-2560x1440": { width: 2560, height: 1440 },
} as const;
const PORT = 4300;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: WORKERS,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `NEXT_PUBLIC_E2E=1 pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
    name,
    use: { ...devices["Desktop Safari"], viewport },
  })),
});
