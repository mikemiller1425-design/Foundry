import { test } from "@playwright/test";
import {
  assertMeasuringAtViewport,
  BUDGET,
  reachFullPanelLoad,
  recordMetric,
  sampleFrameRate,
} from "./measure";

/**
 * FBL-034 — "45+ FPS target in world mode; 30 FPS minimum under full
 * panels" (v1-acceptance.md § Performance), at all three target viewports.
 *
 * Two numbers are asserted from one sample because the budget has two
 * halves and they fail differently:
 *
 *  - **Average ≥ 45 FPS** is the target: the system is keeping up.
 *  - **Sustained low ≥ 30 FPS** (95th-percentile frame time) is the floor:
 *    no sustained stutter. An average can sit comfortably at 50 while
 *    every twentieth frame takes 100 ms, and the operator would describe
 *    that as "janky", not "responsive at desk distance".
 */
const SAMPLE_MS = 4000;

test.describe("Frame rate under full-panel load", () => {
  test("world mode sustains the target frame rate with every panel live", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await reachFullPanelLoad(page);
    await assertMeasuringAtViewport(page, testInfo);

    const sample = await sampleFrameRate(page, SAMPLE_MS);

    console.log(
      `PERF-DETAIL | ${testInfo.project.name} | frames=${sample.frames} avg=${sample.averageFps.toFixed(1)}fps low=${sample.sustainedLowFps.toFixed(1)}fps worstFrame=${sample.worstFrameMs.toFixed(1)}ms`,
    );

    await recordMetric(
      testInfo,
      "fps-average-full-panel",
      sample.averageFps,
      "fps",
      BUDGET.targetFps,
      "at-least",
    );
    await recordMetric(
      testInfo,
      "fps-sustained-low-full-panel",
      sample.sustainedLowFps,
      "fps",
      BUDGET.minimumFps,
      "at-least",
    );
  });
});
