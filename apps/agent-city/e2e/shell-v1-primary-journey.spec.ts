import { expect, test, type Page } from "@playwright/test";
import { pauseDemoForStableFeed } from "./stable-state";

// FBL-022 — the complete Agent City V1 primary journey (v1-acceptance.md
// § "Primary user journey"; v1-scope.md § "Required workflow"), run live
// against the deterministic mock runtime end-to-end through Warehouse
// Level 2 completion. Complements the exhaustive step-by-step unit-level
// proof in v1PrimaryJourney.test.ts with real-browser, real-timing
// confirmation that the same journey is observable by an operator.

/** Drives an already-loaded, already-running page through to upgrade completion. */
async function driveToUpgradeCompletion(page: Page) {
  await page.selectOption("#demo-speed", "4");
  await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("command-feedback")).toHaveText("Demo complete", {
    timeout: 20000,
  });
}

/** Loads a fresh page and drives it through to upgrade completion. */
async function runFullJourneyToUpgradeCompletion(page: Page) {
  await page.goto("/");
  await driveToUpgradeCompletion(page);
}

test.describe("V1 primary journey — complete end-to-end run (FBL-022)", () => {
  test("every major transition is comprehensible within ten seconds: running, who's working, blocked, failed, needs approval, completed, upgrade", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    // 1-2: objective submitted, build created, running.
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");
    // Scoped to the left nav's "Current build" section specifically — the
    // objective text also appears in timeline rows once they accumulate
    // (operator.objective_submitted, build.created), which would otherwise
    // make this locator ambiguous.
    await expect(
      page.getByTestId("shell-left-nav").getByText(/Build a basic task-management/),
    ).toBeVisible({ timeout: 10000 });

    // 6-7: the intentional failure visibly blocks progress.
    await expect(page.getByText("status: blocked", { exact: false })).toBeVisible({
      timeout: 15000,
    });
    const builderRow = page.getByTestId("agent-list-item").filter({ hasText: "builder" });
    await expect(builderRow).toContainText(/waiting|working/);

    // 8-9: repair, then independent Inspector validation.
    await expect(page.getByText("status: blocked", { exact: false })).not.toBeVisible({
      timeout: 15000,
    });

    // 12-13: approval requested, Lighthouse attention.
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("lighthouse-status")).toHaveText(/Attention required/);

    // 15-16: valid approval resumes progression; build completes.
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("command-feedback")).toHaveText("Demo complete", {
      timeout: 20000,
    });
    await expect(page.getByText("status: completed", { exact: false })).toBeVisible();

    // 17-21: upgrade eligibility through Level 2, atomically. "upgrading"
    // itself is a transient status (event-model.md: badge-only until
    // completion) that may already have resolved by the time this
    // assertion runs at 4x speed — level: 2 is the durable, required
    // proof that the upgrade actually completed.
    const warehouseRow = page.getByTestId("building-list-item").nth(5);
    await warehouseRow.click();
    await expect(page.getByTestId("shell-detail-panel")).toContainText("level: 2", {
      timeout: 10000,
    });
  });

  test("cargo stays blocked and the vehicle stays parked through the intentional failure, then transfer authorizes and completes", async ({
    page,
  }) => {
    // Longer than before because the observation phase now runs at 1×
    // deliberately. This is a budget for work that genuinely takes longer,
    // not slack bought to absorb a race — the race itself is removed by
    // observing a state that outlasts the sampling interval.
    test.setTimeout(90000);
    await page.goto("/");
    const cargoMarker = page.locator(
      '[data-testid="world-object-marker"][data-object-id="cargo-current-build"]',
    );
    const vehicleMarker = page.locator(
      '[data-testid="world-object-marker"][data-object-id="vehicle-utility-1"]',
    );
    await expect(cargoMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });
    await expect(vehicleMarker).toHaveAttribute("data-state", "Parked");

    // Observe the Blocked window at normal speed — the marker text is
    // sampled every 150 ms and 4× playback emits every 50 ms, so a short
    // state can slip between two samples. Accelerate afterwards.
    await expect(cargoMarker).toHaveAttribute("data-state", "Blocked", { timeout: 30000 });
    await expect(vehicleMarker).toHaveAttribute("data-state", "Parked");

    await expect(cargoMarker).not.toHaveAttribute("data-state", "Blocked", { timeout: 30000 });
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("command-feedback")).toHaveText("Demo complete", {
      timeout: 20000,
    });
  });

  test("upgrade eligibility, approval, and Level 2 completion are all reachable and reported correctly", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await runFullJourneyToUpgradeCompletion(page);

    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Upgrade completed" }).first(),
    ).toBeVisible({ timeout: 5000 });

    const warehouseMarker = page.locator(
      '[data-testid="world-object-marker"][data-object-id="warehouse"]',
    );
    await expect(warehouseMarker).toHaveAttribute("data-visible", "true");

    await page.getByTestId("building-list-item").nth(5).click(); // 0 lighthouse,1-3 residences,4 office,5 warehouse
    await expect(page.getByTestId("shell-detail-panel")).toContainText("level: 2");
  });

  test("2D-only comprehension: every major transition is identifiable from the 2D panels alone, without reading the 3D world", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto("/");

    // What is running.
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");

    // What is blocked, and who is working. The stage's own "blocked"
    // status/reason persists for the entire window between stage.blocked
    // and that stage's own stage.completed (the whole retry sequence),
    // unlike the individual requirement's failed→passed transition, which
    // clears within a few events — a live browser check here targets the
    // durable signal, not the narrow one (the narrow one is proven
    // precisely, without a real-timing race, at the unit level in
    // selectors.test.ts).
    const frontendStageRow = page
      .getByTestId("stage-list-item")
      .filter({ hasText: "Frontend implementation" });
    // Run this stretch at normal speed: the blocked window is a handful of
    // events, and at 4× it can close between the assertion that observes
    // it and the pause that is supposed to hold it.
    await expect(frontendStageRow).toContainText("blocked", { timeout: 30000 });
    // Pause and *confirm the runtime actually stopped* before reading the
    // detail panel. A bare click only guarantees the event was dispatched;
    // playback continues until the command is applied, which was long
    // enough for the retry to resolve the block and for this test to read
    // a completed stage where it expected a blocked one.
    await pauseDemoForStableFeed(page);
    await expect(page.getByTestId("agent-list-item").filter({ hasText: "builder" })).toBeVisible();

    // What failed (the blocked reason, from the stage detail panel).
    await frontendStageRow.click();
    await expect(page.getByTestId("shell-detail-panel")).toContainText(
      "Mandatory requirement failed",
      { timeout: 5000 },
    );

    // Recovery, then what needs approval. Accelerate first: the remaining
    // stretch is one where only the end state matters, and leaving it at
    // 1× would push it past the timeout for no observational benefit.
    await page.selectOption("#demo-speed", "4");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("approval-card")).toContainText("Approve deployment package");

    // What completed, and what happens next (upgrade), all via 2D only.
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("status: completed", { exact: false })).toBeVisible({
      timeout: 20000,
    });
    await page.getByTestId("building-list-item").nth(5).click();
    await expect(page.getByTestId("shell-detail-panel")).toContainText("level: 2", {
      timeout: 15000,
    });
  });

  test("selection stays synchronized on the Warehouse across the entire journey through upgrade completion", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    const warehouseMarker = page.locator(
      '[data-testid="world-object-marker"][data-object-id="warehouse"]',
    );
    await expect(warehouseMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });

    await page.getByTestId("building-list-item").nth(5).click();
    await expect(warehouseMarker).toHaveAttribute("data-selected", "true");

    await driveToUpgradeCompletion(page);

    await expect(warehouseMarker).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Building: Warehouse");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("level: 2");
  });

  test("reduced motion: the complete journey through upgrade completion communicates identical operational meaning", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await runFullJourneyToUpgradeCompletion(page);

    await expect(page.getByText("status: completed", { exact: false })).toBeVisible();
    await page.getByTestId("building-list-item").nth(5).click();
    await expect(page.getByTestId("shell-detail-panel")).toContainText("level: 2");
    await expect(page.getByTestId("lighthouse-status")).not.toHaveText(/Attention required/);
  });

  test("duplicate-event safe: replay produces the identical final journey outcome, no duplicated rows or approvals", async ({
    page,
  }) => {
    test.setTimeout(75000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    // Checked immediately, before further playback (~15 more events)
    // scrolls it out of the virtualized timeline's rendered window —
    // the same discipline the incremental checks elsewhere in this suite
    // already follow.
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Approval approved" }),
    ).toHaveCount(1, { timeout: 5000 });
    const countBefore = await page.getByTestId("event-count-summary").innerText();
    await expect(page.getByTestId("command-feedback")).toHaveText("Demo complete", {
      timeout: 20000,
    });

    // Replay re-emits the identical seeded sequence from scratch — the
    // speed select retains its current value (no page reload), so no
    // extra demo.set_speed command is needed here.
    await page.getByRole("button", { name: "Replay", exact: true }).click();
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Approval approved" }),
    ).toHaveCount(1, { timeout: 5000 });
    const countAfterApproval = await page.getByTestId("event-count-summary").innerText();
    await expect(page.getByTestId("command-feedback")).toHaveText("Demo complete", {
      timeout: 20000,
    });

    // The replayed run's own event count at the equivalent point (right
    // after its own approval) is a few events lower than the first run's —
    // replay's internal restart doesn't re-emit the page-load-only
    // `demo.start` command pair the first run's count includes — but must
    // never be *inflated* by the prior run's events still sitting in
    // state. A regression here previously left the prior run's ~100+
    // events in place and appended the replay's own sequence on top,
    // silently duplicating every timeline row from the run being
    // replayed; this asserts the replayed count is close to, never
    // roughly double, the first run's.
    const parseCount = (text: string): number => Number(text.split("/")[0]!.trim());
    expect(parseCount(countAfterApproval)).toBeLessThan(parseCount(countBefore) * 1.2);
    expect(parseCount(countAfterApproval)).toBeGreaterThan(parseCount(countBefore) * 0.8);
  });

  test("existing 2D functionality (timeline, command bar) remains unaffected by the complete journey", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await runFullJourneyToUpgradeCompletion(page);
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
    await expect(page.getByTestId("command-feedback")).toHaveText("Demo complete");
  });
});
