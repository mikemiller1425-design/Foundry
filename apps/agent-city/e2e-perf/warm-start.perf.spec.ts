import { test } from "@playwright/test";
import { BUDGET, recordMetric, waitForUsableShell } from "./measure";

/**
 * FBL-034 — "Usable shell < 3 s local warm start on target Mac"
 * (v1-acceptance.md § Performance).
 *
 * *Warm* is load-bearing. A cold start includes the Next.js production
 * server's first-request work, which the operator pays once per boot and
 * never again during a session; measuring it and calling it the warm-start
 * budget would be measuring the wrong thing in the pessimistic direction.
 * So the first navigation warms the server and is not timed; the timed
 * navigation is the second one — the operator reloading a running system.
 *
 * The timer stops on *usable*, not on `load`. A shell that has painted but
 * cannot yet be commanded has not met a budget about usability.
 */
test.describe("Warm start", () => {
  test("reaches a usable shell inside the warm-start budget", async ({ page }, testInfo) => {
    // Warm the server route and the browser's module cache. Untimed.
    await page.goto("/");
    await waitForUsableShell(page);

    // `commit` stops the navigation wait at the first byte, so everything
    // from there to "usable" is inside the measurement rather than hidden
    // behind Playwright's default load-event wait.
    const startedAt = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    await waitForUsableShell(page);
    const elapsedMs = Date.now() - startedAt;

    await recordMetric(testInfo, "warm-start", elapsedMs, "ms", BUDGET.warmStartMs, "at-most");
  });
});
