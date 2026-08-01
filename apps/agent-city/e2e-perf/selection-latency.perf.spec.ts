import { expect, test } from "@playwright/test";
import { BUDGET, reachFullPanelLoad, recordMetric } from "./measure";

/**
 * FBL-034 — "Selection feedback < 100 ms" (v1-acceptance.md § Performance).
 *
 * Measured entirely inside the page, in one clock domain: the timer starts
 * on the click and stops on the animation frame *after* the detail panel
 * changes. Stopping on the DOM mutation alone would credit the app for
 * work the operator cannot see yet; "feedback" means painted.
 *
 * Driving this from Node instead would fold Playwright's RPC round-trip
 * into a 100 ms budget, which is a meaningful fraction of it.
 */
const SELECTION_SAMPLES = 6;

test.describe("Selection feedback latency", () => {
  test("selecting a world object paints feedback inside the budget", async ({ page }, testInfo) => {
    await page.goto("/");
    await reachFullPanelLoad(page);

    const itemCount = await page.getByTestId("building-list-item").count();
    expect(itemCount, "need at least two selectable objects to alternate between").toBeGreaterThan(
      1,
    );

    const latencies = await page.evaluate(async (samples) => {
      const items = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="building-list-item"]'),
      );
      const panel = document.querySelector('[data-testid="shell-detail-panel"]');
      if (!panel) throw new Error("no detail panel");

      const measured: number[] = [];
      for (let i = 0; i < samples; i += 1) {
        // Always move to a *different* object. Re-selecting the one
        // already selected produces no panel change, so the observer would
        // sit until some unrelated event mutated the panel and report that
        // delay as selection latency — measuring the demo's pacing rather
        // than the app's responsiveness. The caller has already selected
        // item 0, so the walk starts at item 1.
        const target = items[(i + 1) % items.length];
        if (!target) throw new Error("no selectable item");
        if (items.length < 2) throw new Error("need two distinct selectable objects");

        const elapsed = await new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error("no selection feedback within 5s"));
          }, 5000);
          const observer = new MutationObserver(() => {
            observer.disconnect();
            clearTimeout(timeout);
            // Resolve on the next frame: the mutation is now painted.
            requestAnimationFrame(() => resolve(performance.now() - startedAt));
          });
          observer.observe(panel, { subtree: true, childList: true, characterData: true });
          const startedAt = performance.now();
          target.click();
        });
        measured.push(elapsed);
      }
      return measured;
    }, SELECTION_SAMPLES);

    const worst = Math.max(...latencies);
    const median = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)] ?? 0;

    console.log(
      `PERF-DETAIL | ${testInfo.project.name} | selection latencies (ms): ${latencies
        .map((v) => v.toFixed(1))
        .join(", ")}`,
    );

    await recordMetric(
      testInfo,
      "selection-feedback-median",
      median,
      "ms",
      BUDGET.selectionFeedbackMs,
      "at-most",
    );
    // The worst case is asserted too: a budget met on median but blown on
    // the tail is a budget the operator experiences as missed.
    await recordMetric(
      testInfo,
      "selection-feedback-worst",
      worst,
      "ms",
      BUDGET.selectionFeedbackMs,
      "at-most",
    );
  });
});
