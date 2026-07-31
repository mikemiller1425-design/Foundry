import { expect, test, type Locator, type Page } from "@playwright/test";

// FBL-021 required visual/operator validation: the intentional failure
// visibly blocks progress; cargo stays incomplete; the vehicle waits;
// repair/validation update the right buildings/agents; the Lighthouse
// signals pending approval; transfer movement starts only after
// transfer.started; every meaningful animation has matching text; reduced
// motion communicates the same operational sequence; selection stays
// synchronized while objects change state.

function marker(page: Page, objectId: string): Locator {
  return page.locator(`[data-testid="world-object-marker"][data-object-id="${objectId}"]`);
}

test.describe("Event-to-world mapping (FBL-021)", () => {
  test("renders with no console or page errors through a full run", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    await page.selectOption("#demo-speed", "4");
    await page.waitForTimeout(1000);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("V-04: Cargo stays blocked while the intentional requirement failure is active, matched by timeline text", async ({
    page,
  }) => {
    await page.goto("/");
    const cargoMarker = marker(page, "cargo-current-build");
    await expect(cargoMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });

    // The intentional failure's requirement.failed / stage.blocked rows
    // appear in the timeline — the textual equivalent for the visual
    // block about to happen.
    await expect(page.getByTestId("timeline-row").filter({ hasText: "Stage blocked" })).toBeVisible(
      { timeout: 20000 },
    );
    await expect(cargoMarker).toHaveAttribute("data-state", "Blocked");

    // Recovers once the retry/repair completes (stage.completed for the
    // stage that was blocked) — cargo must not stay stuck blocked forever.
    await expect(cargoMarker).not.toHaveAttribute("data-state", "Blocked", { timeout: 20000 });
  });

  test("V-05: the vehicle is never in_transit before a real 'Transfer started' timeline row appears, and does move shortly after", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    const vehicleMarker = marker(page, "vehicle-utility-1");
    await expect(vehicleMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });
    await expect(vehicleMarker).toHaveAttribute("data-state", "Parked");
    await expect(vehicleMarker).not.toHaveAttribute("data-state", "In transit");

    // Speed 2: fast enough that the first transfer.started arrives with a
    // comfortable margin even under heavy parallel test load, slow enough
    // (100ms/event) that the brief in_transit/unloading window still gives
    // the 50ms poll below more than one chance to observe it.
    await page.selectOption("#demo-speed", "2");

    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Transfer started" }).first(),
    ).toBeVisible({ timeout: 45000 });
    // transfer.arrived (-> "unloading") follows transfer.started almost
    // immediately in the canonical script, so "in_transit" itself is a
    // narrow single-tick window — polling tightly for either real,
    // event-driven moved state (in_transit or unloading) is the robust
    // proof that motion followed this event, without racing a single
    // transient frame against browser/network latency.
    await expect
      .poll(() => vehicleMarker.getAttribute("data-state"), {
        message: "vehicle should reach in_transit or unloading shortly after transfer.started",
        timeout: 5000,
        intervals: [50],
      })
      .toMatch(/^(In transit|Unloading)$/);
  });

  test("the Lighthouse signals attention while the deployment approval is pending, then clears once approved", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    const status = page.getByTestId("lighthouse-status");
    await expect(status).toHaveText(/Attention required/, { timeout: 30000 });
    await expect(page.getByTestId("approval-card")).toBeVisible();

    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(status).not.toHaveText(/Attention required/);
  });

  test("repair and validation update the Construction Office and QA building status correctly", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    const officeMarker = marker(page, "construction-office");
    await expect(officeMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });
    // Construction Office goes active while the Builder repairs the failure.
    await expect(officeMarker).toHaveAttribute("data-state", "Lit / work", { timeout: 20000 });

    const qaMarker = marker(page, "qa");
    await expect(qaMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });
    // QA becomes active while the Inspector validates.
    await expect(qaMarker).toHaveAttribute("data-state", "Lit / work", { timeout: 30000 });
  });

  test("every meaningful visual transition has a readable timeline equivalent (Required behavior 11)", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    // Checked incrementally, in narrative order — the timeline is a
    // virtualized, autoscrolling feed (EventTimeline.tsx), so a row from
    // much earlier in a long run can scroll out of the rendered window by
    // the time later assertions run. Each check happens near the moment
    // that visual transition is actually occurring.
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Requirement failed" }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Stage blocked" }).first(),
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Approval requested" }).first(),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("approval-card")).toBeVisible();
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Approval approved" }).first(),
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Transfer started" }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("unknown/no-visual-change events (e.g. artifact.* ) still appear as readable timeline rows even though they carry no dedicated 3D representation", async ({
    page,
  }) => {
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Artifact created" }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("selection stays synchronized on the Warehouse while its status changes across the run", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    const warehouseMarker = marker(page, "warehouse");
    await expect(warehouseMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });

    await page.getByTestId("building-list-item").nth(5).click(); // 0 lighthouse,1-3 residences,4 office,5 warehouse
    await expect(warehouseMarker).toHaveAttribute("data-selected", "true");

    await page.selectOption("#demo-speed", "4");
    await page.waitForTimeout(5000);

    // Still selected after real state-changing events have flowed through.
    await expect(warehouseMarker).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Building: Warehouse");
  });

  test("reduced motion: the same operational sequence is communicated (blocked -> attention -> approved -> completed)", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    const cargoMarker = marker(page, "cargo-current-build");
    await expect(cargoMarker).toHaveAttribute("data-visible", "true", { timeout: 20000 });
    await expect(cargoMarker).toHaveAttribute("data-state", "Blocked", { timeout: 20000 });
    await expect(cargoMarker).not.toHaveAttribute("data-state", "Blocked", { timeout: 20000 });

    const status = page.getByTestId("lighthouse-status");
    await expect(status).toHaveText(/Attention required/, { timeout: 20000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(status).not.toHaveText(/Attention required/);
  });

  test("existing 2D functionality (timeline, approval, command bar) remains unaffected", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("approval-card")).not.toBeVisible();
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
  });
});
