import { expect, test } from "@playwright/test";
import { BUDGET, reachFullPanelLoad, recordMetric } from "./measure";

/**
 * FBL-034 — "Realtime update visible < 500 ms on local network"
 * (v1-acceptance.md § Performance).
 *
 * The budget spans two independent halves, and this file measures one of
 * them on purpose rather than blurring them into a single number:
 *
 *  1. **Transport** — backend append to client-readable over HTTP. Already
 *     measured, against the real server, by FBL-026's
 *     `apps/api/src/latency.test.ts` ("delivers a newly appended event well
 *     inside the <500 ms budget").
 *  2. **Render** — event reaching the client to *painted in the operator's
 *     timeline*. Nothing measured this before, and it is the half that
 *     degrades at 5120×1440, because it competes with the 3D world for the
 *     same main thread. That is what this file measures, at all three
 *     target viewports, under full-panel load.
 *
 * Both halves travel the identical client path — the runtime notifies, React
 * re-renders, the virtualized feed paints — so measuring it via a locally
 * originated command event exercises exactly the code an SSE frame would.
 * What is deliberately *not* claimed here is a single end-to-end number: the
 * mock runtime is its own authority (ADR-001) and has no network hop to
 * measure, so this is reported as the render half, not as the whole budget.
 */
const SAMPLES = 6;

test.describe("Realtime update visibility latency", () => {
  test("an emitted event is painted into the timeline inside the budget", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await reachFullPanelLoad(page);

    const latencies = await page.evaluate(async (samples) => {
      const feed = document.querySelector('[role="log"][aria-label="Event timeline"]');
      if (!feed) throw new Error("no event feed");

      function controlNamed(name: string): HTMLButtonElement {
        const button = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent?.trim() === name && !b.disabled,
        );
        if (!button) throw new Error(`no enabled "${name}" control`);
        return button as HTMLButtonElement;
      }

      const measured: number[] = [];
      for (let i = 0; i < samples; i += 1) {
        // Alternating Pause/Resume gives both a sample taken while the
        // feed is streaming at full rate (the Pause click) and one taken
        // from rest (the Resume click). The worst of the two is what the
        // operator experiences, so both are recorded.
        const control = controlNamed(i % 2 === 0 ? "Pause" : "Resume");
        const expectedText = i % 2 === 0 ? "demo.pause" : "demo.resume";

        const elapsed = await new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`no visible row for ${expectedText} within 5s`));
          }, 5000);
          const observer = new MutationObserver(() => {
            const painted = Array.from(
              document.querySelectorAll('[data-testid="timeline-row"]'),
            ).some((row) => row.textContent?.includes(expectedText));
            if (!painted) return;
            observer.disconnect();
            clearTimeout(timeout);
            requestAnimationFrame(() => resolve(performance.now() - startedAt));
          });
          observer.observe(feed, { subtree: true, childList: true, characterData: true });
          const startedAt = performance.now();
          control.click();
        });
        measured.push(elapsed);
      }
      return measured;
    }, SAMPLES);

    expect(latencies).toHaveLength(SAMPLES);
    const worst = Math.max(...latencies);

    console.log(
      `PERF-DETAIL | ${testInfo.project.name} | realtime-visible latencies (ms): ${latencies
        .map((v) => v.toFixed(1))
        .join(", ")}`,
    );

    await recordMetric(
      testInfo,
      "realtime-visible-worst",
      worst,
      "ms",
      BUDGET.realtimeVisibleMs,
      "at-most",
    );
  });
});
