import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * FBL-034 shared measurement helpers.
 *
 * Two rules hold across every file in this directory:
 *
 *  - **Synchronize on stable state, never on elapsed time.** A `waitForTimeout`
 *    inside a performance test is self-defeating: it makes the measurement
 *    depend on the very slowness being measured, and it is the mechanism
 *    that produced the timing races this rung was assigned to repair.
 *
 *  - **A budget is a gate, not a label.** Every measurement asserts. A
 *    recorded number that nothing checks is a number that will drift.
 */

/** Budgets from docs/02-specification/v1-acceptance.md § "Performance". */
export const BUDGET = {
  warmStartMs: 3000,
  targetFps: 45,
  minimumFps: 30,
  selectionFeedbackMs: 100,
  realtimeVisibleMs: 500,
  retainedEvents: 10_000,
} as const;

export interface FrameRateSample {
  frames: number;
  averageFps: number;
  /** Frame rate implied by the 95th-percentile (slowest) frame times — what the worst moments felt like. */
  sustainedLowFps: number;
  worstFrameMs: number;
}

/**
 * Records a measurement against its budget: printed for the run log,
 * attached to the Playwright report, and asserted.
 */
export async function recordMetric(
  testInfo: TestInfo,
  metric: string,
  value: number,
  unit: string,
  budget: number,
  direction: "at-most" | "at-least",
): Promise<void> {
  const pass = direction === "at-most" ? value <= budget : value >= budget;
  const comparator = direction === "at-most" ? "<=" : ">=";
  const line = `PERF | ${testInfo.project.name} | ${metric} | ${value.toFixed(1)} ${unit} | budget ${comparator} ${budget} ${unit} | ${pass ? "PASS" : "FAIL"}`;
  console.log(line);
  await testInfo.attach(`${metric}.txt`, { body: line, contentType: "text/plain" });

  if (direction === "at-most") {
    expect(value, `${metric} exceeded its budget`).toBeLessThanOrEqual(budget);
  } else {
    expect(value, `${metric} fell below its budget`).toBeGreaterThanOrEqual(budget);
  }
}

/**
 * Resolves when the shell is *usable* — not merely when the document
 * loaded. "Usable" is the operator's definition: the world region is
 * present, the operational controls are live, and the timeline is
 * carrying real events. That is what the < 3 s warm-start budget is
 * about, so it is what the timer must stop on.
 */
export async function waitForUsableShell(page: Page): Promise<void> {
  await expect(page.getByTestId("shell-world")).toBeVisible();
  await expect(page.getByTestId("shell-left-nav")).toBeVisible();
  await expect(page.getByTestId("shell-timeline")).toBeVisible();
  // The command bar reports "Running" only once the runtime has accepted
  // demo.start — i.e. the operator can actually command the system.
  await expect(page.getByTestId("command-feedback")).toHaveText(/Running|Paused|Demo complete/);
  await expect(page.getByTestId("timeline-row").first()).toBeVisible();
}

/**
 * Fails loudly if the page is not actually rendering at the viewport this
 * project claims to measure.
 *
 * This exists because the failure mode is silent and flattering: if the
 * browser clamps the window, or the canvas never sizes to its container,
 * every budget below is met easily — by measuring a smaller screen than
 * the one ADR-005 commits to. A performance result recorded under the
 * wrong viewport is worse than no result, because it reads as evidence.
 */
export async function assertMeasuringAtViewport(page: Page, testInfo: TestInfo): Promise<void> {
  const expected = testInfo.project.use.viewport;
  if (!expected) throw new Error("perf projects must pin a viewport");

  const actual = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="shell-world"] canvas');
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      cssWidth: canvas?.clientWidth ?? 0,
      cssHeight: canvas?.clientHeight ?? 0,
      renderer:
        gl && debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "unknown",
    };
  });

  expect(actual.innerWidth, "page is not rendering at the project's viewport width").toBe(
    expected.width,
  );
  expect(actual.innerHeight, "page is not rendering at the project's viewport height").toBe(
    expected.height,
  );
  // The world canvas must occupy a real share of that viewport — a
  // collapsed or zero-sized canvas would make the FPS figure meaningless.
  expect(actual.canvasWidth, "world canvas has no drawing buffer").toBeGreaterThan(0);
  expect(actual.cssWidth, "world canvas is not laid out").toBeGreaterThan(expected.width / 3);

  // The budget describes the operator's GPU-backed machine. A software
  // rasteriser would produce a number that is real but answers a different
  // question, and recording it as the budget result would be a false pass.
  expect(
    actual.renderer,
    `WebGL is falling back to a software renderer (${actual.renderer}); this measurement would not describe the target Mac`,
  ).not.toMatch(/SwiftShader|Software|llvmpipe/i);

  console.log(
    `PERF-VIEWPORT | ${testInfo.project.name} | window=${actual.innerWidth}x${actual.innerHeight} dpr=${actual.devicePixelRatio} canvasBuffer=${actual.canvasWidth}x${actual.canvasHeight} canvasCss=${actual.cssWidth}x${actual.cssHeight} renderer="${actual.renderer}"`,
  );
}

/**
 * Drives the shell into the full-density configuration the FPS budget is
 * specified against: every panel expanded, the 3D world live, a selection
 * populating the detail panel, and the event feed streaming.
 *
 * ADR-005's ultrawide commitment is about *this* configuration — an empty
 * shell rendering quickly proves nothing.
 */
export async function reachFullPanelLoad(page: Page): Promise<void> {
  await waitForUsableShell(page);
  // Panels ship expanded; assert rather than assume, so a future default
  // change turns into a visible failure instead of a quietly easier test.
  await expect(page.getByRole("button", { name: "Collapse left navigation" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Collapse right live-intelligence" }),
  ).toBeVisible();
  await expect(page.getByTestId("shell-intel")).toBeVisible();

  // A populated detail panel is part of full-panel load.
  await page.getByTestId("building-list-item").first().click();
  await expect(page.getByTestId("shell-detail-panel")).toContainText("Building:");

  // World objects are actually projected into the scene (the 3D content
  // whose cost this rung measures), not just a mounted empty canvas.
  await expect(page.getByTestId("world-object-marker").first()).toBeAttached();
}

/**
 * Samples real frame pacing via requestAnimationFrame inside the page.
 *
 * Reports both the average and the slow tail. An average alone hides
 * stutter: 45 FPS average with periodic 200 ms hitches is not a system
 * that "feels responsive at desk distance", which is the property the
 * operator is asked to confirm.
 */
export async function sampleFrameRate(page: Page, durationMs: number): Promise<FrameRateSample> {
  return page.evaluate(async (duration) => {
    return new Promise<FrameRateSample>((resolve) => {
      const deltas: number[] = [];
      let last = performance.now();
      const startedAt = last;
      // Discard the first few frames: the first rAF after an evaluate
      // round-trip carries scheduling noise that is not render cost.
      let warmup = 5;

      function tick(now: number) {
        const delta = now - last;
        last = now;
        if (warmup > 0) {
          warmup -= 1;
        } else {
          deltas.push(delta);
        }
        if (now - startedAt < duration) {
          requestAnimationFrame(tick);
          return;
        }
        const sorted = [...deltas].sort((a, b) => a - b);
        const percentile = (q: number) =>
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
        const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
        resolve({
          frames: deltas.length,
          averageFps: mean > 0 ? 1000 / mean : 0,
          sustainedLowFps: percentile(0.95) > 0 ? 1000 / percentile(0.95) : 0,
          worstFrameMs: sorted[sorted.length - 1] ?? 0,
        });
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}
